"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppUser, type AppUser } from "@/lib/auth";
import { phoneDigits, phonesMatch } from "@/lib/phone";
import { vnToday, subscriptionExpiry } from "@/lib/dates";

// Server actions кабинета инструктора. Общий принцип безопасности:
// instructor_id / sold_by / created_by берутся из СЕССИИ на сервере (user.id),
// а не из формы — подделать чужой id нельзя. Вторым рубежом это же проверяет
// RLS (политики sessions_insert_instructor и т.п.).

export interface ActionState {
  error: string | null;
}

// Скидка по реф-ссылке — 200 000 ₫ на базовое обучение (архитектура, раздел 2).
const REF_DISCOUNT = 200_000;

async function requireStaff(): Promise<AppUser> {
  const user = await getAppUser();
  if (!user || (user.role !== "instructor" && user.role !== "admin")) {
    redirect("/login?next=/instructor");
  }
  return user;
}

// Найти клиента по телефону (гибкое сравнение цифр) или создать нового.
// Телефоны в заявках с сайта лежат «как ввёл гость», поэтому сравниваем в JS.
// Клиентов у школы сотни, не миллионы — выборка дешёвая; если база вырастет,
// на этапе 4 добавим нормализованную колонку и индекс.
async function findOrCreateClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: AppUser,
  input: {
    name: string;
    phone: string;
    source: "site" | "offline";
    referrer?: { type: "agent"; id: string } | null;
  },
): Promise<{ id: string } | { error: string }> {
  const { data: existing, error: selError } = await supabase
    .from("clients")
    .select("id, phone")
    .not("phone", "is", null)
    .limit(1000);
  if (selError) return { error: `Не удалось найти клиента: ${selError.message}` };

  const match = (existing ?? []).find((c) => phonesMatch(c.phone, input.phone));
  if (match) return { id: match.id };

  const { data: created, error: insError } = await supabase
    .from("clients")
    .insert({
      name: input.name,
      phone: phoneDigits(input.phone) || input.phone,
      source: input.referrer ? "agent" : input.source,
      referrer_type: input.referrer?.type ?? null,
      referrer_id: input.referrer?.id ?? null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insError || !created) {
    return { error: `Не удалось создать клиента: ${insError?.message ?? "?"}` };
  }
  return { id: created.id };
}

// ── «Записать клиента» ────────────────────────────────────────────────────────
export async function recordClientAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireStaff();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const serviceId = String(formData.get("serviceId") ?? "");
  const date = String(formData.get("date") ?? "") || vnToday();
  const bookingId = String(formData.get("bookingId") ?? "") || null;

  if (!name || !phone || !serviceId) {
    return { error: "Заполните имя, телефон и услугу." };
  }

  // Реф-код берём из ЗАЯВКИ на сервере (не из формы — там его можно подменить).
  let refCode: string | null = null;
  if (bookingId) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, ref_code")
      .eq("id", bookingId)
      .maybeSingle();
    refCode = booking?.ref_code ?? null;
  }

  // Резолвим реф-код → агент. Коды членов клуба появятся на этапе 5 —
  // TODO(этап 5): искать код и среди членов, награда минутами (+10/+30).
  let agent: { id: string; commission_fixed: number } | null = null;
  if (refCode) {
    const { data } = await supabase
      .from("agents")
      .select("id, commission_fixed")
      .eq("ref_code", refCode)
      .eq("active", true)
      .maybeSingle();
    agent = data ?? null;
  }

  const clientResult = await findOrCreateClient(supabase, user, {
    name,
    phone,
    source: bookingId ? "site" : "offline",
    referrer: agent ? { type: "agent", id: agent.id } : null,
  });
  if ("error" in clientResult) return { error: clientResult.error };
  const clientId = clientResult.id;

  const { data: service } = await supabase
    .from("services")
    .select("id, name, price, category")
    .eq("id", serviceId)
    .maybeSingle();
  if (!service) return { error: "Услуга не найдена." };

  // Чек. Скидка по реф-ссылке действует только на базовое обучение.
  let amount = Number(service.price ?? 0);
  const discounted = Boolean(refCode) && service.category === "training";
  if (discounted) amount = Math.max(0, amount - REF_DISCOUNT);

  const { error: sessionError } = await supabase.from("sessions").insert({
    client_id: clientId,
    service_id: service.id,
    instructor_id: user.id,
    date,
    amount,
    created_by: user.id,
  });
  if (sessionError) return { error: `Не удалось записать: ${sessionError.message}` };

  // Награда агенту (pending — админ подтвердит на этапе 4). Комиссия считается
  // от фактического чека, но размер награды фиксированный (commission_fixed).
  if (agent) {
    const { error: rewardError } = await supabase.from("referral_rewards").insert({
      referrer_type: "agent",
      referrer_id: agent.id,
      client_id: clientId,
      reward_type: "money",
      amount: agent.commission_fixed,
    });
    if (rewardError) {
      // Сессия уже записана — не роняем оформление, но проговариваем проблему.
      console.error("[instructor] reward insert error:", rewardError.message);
    }
  }

  // Заявка доведена до занятия → закрываем её и привязываем клиента.
  if (bookingId) {
    await supabase
      .from("bookings")
      .update({ status: "done", client_id: clientId })
      .eq("id", bookingId);
  }

  const params = new URLSearchParams({
    type: "session",
    name,
    amount: String(amount),
    service: service.name,
  });
  if (discounted) params.set("discount", "1");
  redirect(`/instructor/done?${params.toString()}`);
}

// ── Продажа абонемента ────────────────────────────────────────────────────────
export async function sellSubscriptionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireStaff();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const paid = formData.get("paid") === "on";

  if (!name || !phone) return { error: "Заполните имя и телефон." };

  const clientResult = await findOrCreateClient(supabase, user, {
    name,
    phone,
    source: "offline",
  });
  if ("error" in clientResult) return { error: clientResult.error };
  const clientId = clientResult.id;

  // total_minutes (300) и price (6 млн) заданы default'ами в схеме.
  // Минуты живут 3 месяца с продажи. paid_at пишем только при полученной
  // оплате — от него зависит комиссия инструктора (см. 0002).
  const { error: subError } = await supabase.from("subscriptions").insert({
    client_id: clientId,
    sold_by: user.id,
    expires_at: subscriptionExpiry().toISOString(),
    paid_at: paid ? new Date().toISOString() : null,
  });
  if (subError) return { error: `Не удалось создать абонемент: ${subError.message}` };

  // Первый абонемент делает клиента членом клуба.
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!membership) {
    const { error: memError } = await supabase
      .from("memberships")
      .insert({ client_id: clientId });
    if (memError) console.error("[instructor] membership insert error:", memError.message);
  }

  const params = new URLSearchParams({ type: "subscription", name });
  if (paid) params.set("paid", "1");
  redirect(`/instructor/done?${params.toString()}`);
}

// ── Списание минут с абонемента ───────────────────────────────────────────────
export async function writeOffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireStaff();
  const supabase = await createClient();

  const clientId = String(formData.get("clientId") ?? "");
  const clientName = String(formData.get("clientName") ?? "");
  const minutes = Math.floor(Number(formData.get("minutes")));

  if (!clientId || !Number.isFinite(minutes) || minutes <= 0) {
    return { error: "Укажите, сколько минут списать." };
  }

  // Последний активный абонемент клиента.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, total_minutes, expires_at, status")
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("sold_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return { error: "У клиента нет активного абонемента." };

  if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
    await supabase.from("subscriptions").update({ status: "expired" }).eq("id", sub.id);
    return { error: "Абонемент истёк (минуты живут 3 месяца). Продайте новый." };
  }

  // Остаток = всего минус все списания (в т.ч. другими инструкторами —
  // политика sessions_select_instructor такие сессии видеть разрешает).
  const { data: used } = await supabase
    .from("sessions")
    .select("minutes_used")
    .eq("subscription_id", sub.id);
  const usedMinutes = (used ?? []).reduce((s, r) => s + (r.minutes_used ?? 0), 0);
  const left = sub.total_minutes - usedMinutes;

  if (minutes > left) {
    return {
      error: `Остаток ${left} мин — списать ${minutes} нельзя. Превышение оформите отдельной сессией по прайсу проката.`,
    };
  }

  const { error: sessionError } = await supabase.from("sessions").insert({
    client_id: clientId,
    subscription_id: sub.id,
    minutes_used: minutes,
    amount: 0, // списание с абонемента — чека нет, комиссия не начисляется
    instructor_id: user.id,
    created_by: user.id,
    date: vnToday(),
  });
  if (sessionError) return { error: `Не удалось списать: ${sessionError.message}` };

  if (left - minutes === 0) {
    await supabase.from("subscriptions").update({ status: "used_up" }).eq("id", sub.id);
  }

  const params = new URLSearchParams({
    type: "writeoff",
    name: clientName,
    minutes: String(minutes),
    left: String(left - minutes),
  });
  redirect(`/instructor/done?${params.toString()}`);
}
