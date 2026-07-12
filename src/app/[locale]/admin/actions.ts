"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { phoneDigits, phonesMatch } from "@/lib/phone";
import { subscriptionExpiry } from "@/lib/dates";
import { minutesLeft } from "@/lib/subscriptions";
import { sendInstructorsBookingAlert } from "@/lib/telegram";
import type { ActionState } from "../instructor/actions";

// Server actions админки: полный цикл заявки. Админ созванивается с гостем,
// вносит время/возраст/вес и подтверждает — заявка становится «записью»,
// которую видят инструкторы. RLS-политика bookings_admin_all даёт полный доступ.

async function requireAdmin() {
  const user = await getAppUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin");
  return user;
}

// Числовое поле формы → integer или null (пустое/мусор не пишем в базу).
function intOrNull(value: FormDataEntryValue | null): number | null {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Общие поля карточки заявки из формы.
function bookingFields(formData: FormData) {
  return {
    scheduled_time: String(formData.get("scheduledTime") ?? "").trim() || null,
    age: intOrNull(formData.get("age")),
    weight: intOrNull(formData.get("weight")),
    internal_note: String(formData.get("note") ?? "").trim() || null,
  };
}

// Обновить заявку и перерисовать всё, где висят счётчики (админка, кабинет,
// бейдж в шапке) — на масштабе школы дешевле, чем целиться в пути.
async function updateBooking(id: string, patch: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("bookings").update(patch).eq("id", id);
  if (error) console.error("[admin] booking update error:", error.message);
  revalidatePath("/", "layout");
}

// Сообщение в группу инструкторов: «появилась новая запись, кто примет?»
// Телефон клиента в группу не шлём — только номер, услуга и время.
async function notifyInstructors(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("booking_no, scheduled_time, preferred_date, services(name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;
  const service = data.services as unknown as { name: string } | null;
  await sendInstructorsBookingAlert({
    bookingNo: data.booking_no,
    serviceName: service?.name ?? null,
    scheduledTime: data.scheduled_time,
    preferredDate: data.preferred_date,
  });
}

// Клиент пришёл по реф-коду и услуга проведена → награда агента из «ожидает»
// становится «подтверждена» (войдёт в расчёт месяца: клиенты × 300 000 ₫).
async function confirmPendingReward(id: string) {
  const supabase = await createClient();
  const { data: b } = await supabase
    .from("bookings")
    .select("client_id, ref_code")
    .eq("id", id)
    .maybeSingle();
  if (!b?.client_id || !b.ref_code) return;
  const { error } = await supabase
    .from("referral_rewards")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("client_id", b.client_id)
    .eq("status", "pending");
  if (error) console.error("[admin] reward confirm error:", error.message);
}

// «Подтвердить»: сохранить данные созвона и опубликовать запись инструкторам.
export async function confirmBookingAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await updateBooking(id, { ...bookingFields(formData), status: "confirmed" });
  await notifyInstructors(id).catch(() => {});
}

// Смена статуса из карточки: в обработке / подтверждена / выполнена / отменена /
// в архив. Побочные эффекты завязаны на статус, а не на кнопку, чтобы работать
// одинаково из любого места ленты.
export async function setStatusAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowed = ["contacted", "confirmed", "done", "cancelled", "archived"];
  if (!id || !allowed.includes(status)) return;

  if (status === "done") await confirmPendingReward(id);

  const patch: Record<string, unknown> = { status };
  // Закрытые заявки не должны висеть закреплёнными сверху.
  if (status === "done" || status === "cancelled" || status === "archived") {
    patch.pinned = false;
  }
  await updateBooking(id, patch);
  if (status === "confirmed") await notifyInstructors(id).catch(() => {});
}

// ── Сессии (подэтап 4.2) ─────────────────────────────────────────────────────
// Сумма и дата в форме — как их вводит человек: «1 500 000», «1.500.000».
function parseVnd(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").replace(/[\s.,]/g, "");
  if (!s || !/^\d+$/.test(s)) return null;
  return Number(s);
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Дата 'YYYY-MM-DD' из формы → момент timestamptz. Берём полночь UTC = 7 утра
// в Нячанге: дата остаётся «своим» днём и в UTC, и по местному времени.
function dayToIso(day: string): string {
  return new Date(`${day}T00:00:00Z`).toISOString();
}

// Клиент из формы: существующий (select clientId) ИЛИ новый по имени+телефону.
// Перед созданием ищем по телефону — та же логика гибкого сравнения цифр,
// что у инструктора, чтобы не плодить дублей из-за «+84» против «84».
async function resolveClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  adminId: string,
  formData: FormData,
): Promise<{ id: string } | { error: string }> {
  const clientId = String(formData.get("clientId") ?? "");
  if (clientId) return { id: clientId };

  const name = String(formData.get("newName") ?? "").trim();
  const phone = String(formData.get("newPhone") ?? "").trim();
  if (!name || !phone) {
    return { error: "Выберите клиента из списка или заполните имя и телефон нового." };
  }
  const { data: existing } = await supabase
    .from("clients")
    .select("id, phone")
    .not("phone", "is", null)
    .limit(1000);
  const match = (existing ?? []).find((c) => phonesMatch(c.phone, phone));
  if (match) return { id: match.id };

  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      name,
      phone: phoneDigits(phone) || phone,
      source: "offline",
      created_by: adminId,
    })
    .select("id")
    .single();
  if (error || !created) {
    return { error: `Не удалось создать клиента: ${error?.message ?? "?"}` };
  }
  return { id: created.id };
}

// Создать сессию задним числом: инструктор забыл оформить занятие — админ
// вносит его вручную на любую дату. Чек фиксируется в момент создания
// (изменение прайса в будущем прошлые сессии не трогает).
export async function createSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const date = String(formData.get("date") ?? "").trim();
  if (!DAY_RE.test(date)) return { error: "Укажите дату сессии." };

  const serviceId = String(formData.get("serviceId") ?? "");
  const instructorId = String(formData.get("instructorId") ?? "");
  if (!serviceId || !instructorId) {
    return { error: "Выберите услугу и инструктора." };
  }

  const clientRes = await resolveClient(supabase, admin.id, formData);
  if ("error" in clientRes) return clientRes;
  const clientId = clientRes.id;

  const { data: service } = await supabase
    .from("services")
    .select("price")
    .eq("id", serviceId)
    .maybeSingle();
  if (!service) return { error: "Услуга не найдена." };

  // Пустая сумма = по прайсу; введённая вручную — важнее (скидки, брони и т.п.).
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = amountRaw ? parseVnd(amountRaw) : Number(service.price ?? 0);
  if (amount === null) return { error: "Сумма — число в донгах, например 1 500 000." };

  const { error: insError } = await supabase.from("sessions").insert({
    client_id: clientId,
    service_id: serviceId,
    instructor_id: instructorId,
    date,
    amount,
    created_by: admin.id,
  });
  if (insError) return { error: `Не удалось создать сессию: ${insError.message}` };

  // Сессия влияет на выручку, статистику и ЗП — перерисовываем всё.
  revalidatePath("/", "layout");
  redirect("/admin/sessions");
}

// Правка сессии: дата / сумма / услуга / инструктор. Минуты списаний здесь
// не трогаем — для баланса абонемента есть корректировки с комментарием (4.3).
export async function updateSessionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const patch: Record<string, unknown> = {};
  const date = String(formData.get("date") ?? "").trim();
  if (DAY_RE.test(date)) patch.date = date;
  const amount = parseVnd(formData.get("amount"));
  if (amount !== null) patch.amount = amount;
  const instructorId = String(formData.get("instructorId") ?? "");
  if (instructorId) patch.instructor_id = instructorId;
  const serviceId = String(formData.get("serviceId") ?? "");
  if (serviceId) patch.service_id = serviceId;
  if (Object.keys(patch).length === 0) return;

  const supabase = await createClient();
  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  if (error) console.error("[admin] session update error:", error.message);
  revalidatePath("/", "layout");
}

// ── Абонементы (подэтап 4.3) ─────────────────────────────────────────────────
// Продажа от админа: как у инструктора, но продавца выбираем (его 10% комиссия
// после оплаты) и дату можно поставить прошлую. Цена по умолчанию — 6 000 000 ₫.
export async function adminSellSubscriptionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const sellerId = String(formData.get("sellerId") ?? "");
  if (!sellerId) return { error: "Укажите, кто продал абонемент." };

  const soldDay = String(formData.get("soldDate") ?? "").trim();
  if (!DAY_RE.test(soldDay)) return { error: "Укажите дату продажи." };
  const soldAt = dayToIso(soldDay);

  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = priceRaw ? parseVnd(priceRaw) : 6_000_000;
  if (price === null) return { error: "Цена — число в донгах, например 6 000 000." };

  const clientRes = await resolveClient(supabase, admin.id, formData);
  if ("error" in clientRes) return clientRes;
  const clientId = clientRes.id;

  // Минуты живут 3 месяца С ДАТЫ ПРОДАЖИ (в т.ч. прошлой). paid_at — только
  // при полученной оплате: от месяца оплаты зависят выручка и комиссия.
  const paid = formData.get("paid") === "on";
  const { error: subError } = await supabase.from("subscriptions").insert({
    client_id: clientId,
    sold_by: sellerId,
    price,
    sold_at: soldAt,
    expires_at: subscriptionExpiry(new Date(soldAt)).toISOString(),
    paid_at: paid ? soldAt : null,
  });
  if (subError) return { error: `Не удалось создать абонемент: ${subError.message}` };

  // Первый абонемент делает клиента членом клуба (как у инструктора).
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!membership) {
    const { error: memError } = await supabase
      .from("memberships")
      .insert({ client_id: clientId });
    if (memError) console.error("[admin] membership insert error:", memError.message);
  }

  revalidatePath("/", "layout");
  redirect("/admin/subscriptions");
}

// Тумблер оплаты. Поставить — с датой (по умолчанию сегодня; месяц оплаты
// решает, куда упадут выручка и комиссия). Снять — подтверждение на клиенте:
// отметка уже могла войти в расчёты.
export async function togglePaidAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  let paidAt: string | null = null;
  if (formData.get("set") === "1") {
    const day = String(formData.get("paidDate") ?? "").trim();
    paidAt = DAY_RE.test(day) ? dayToIso(day) : new Date().toISOString();
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ paid_at: paidAt })
    .eq("id", id);
  if (error) console.error("[admin] paid toggle error:", error.message);
  revalidatePath("/", "layout");
}

// Ручная корректировка минут: только с комментарием (почему), пишется в лог
// subscription_adjustments от имени админа. Может вернуть абонемент из
// used_up в active (и наоборот), но не воскрешает истёкший.
export async function adjustMinutesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const subId = String(formData.get("subscriptionId") ?? "");
  const delta = Math.trunc(Number(formData.get("delta")));
  const comment = String(formData.get("comment") ?? "").trim();
  if (!subId || !Number.isFinite(delta) || delta === 0) {
    return { error: "Минуты — целое число, не ноль (например 30 или −15)." };
  }
  if (!comment) return { error: "Комментарий обязателен: почему меняем минуты." };

  const { error } = await supabase.from("subscription_adjustments").insert({
    subscription_id: subId,
    delta_minutes: delta,
    comment,
    created_by: admin.id,
  });
  if (error) return { error: `Не удалось сохранить корректировку: ${error.message}` };

  // Пересчёт статуса: минуты кончились ↔ снова появились.
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, total_minutes, status")
    .eq("id", subId)
    .maybeSingle();
  if (sub && (sub.status === "active" || sub.status === "used_up")) {
    const left = await minutesLeft(supabase, sub);
    const next = left <= 0 ? "used_up" : "active";
    if (next !== sub.status) {
      await supabase.from("subscriptions").update({ status: next }).eq("id", subId);
    }
  }

  revalidatePath("/", "layout");
  redirect("/admin/subscriptions");
}

// ── Клиенты (подэтап 4.4) ────────────────────────────────────────────────────
// Правка карточки клиента: имя, телефон, внутренняя заметка. Телефон храним
// цифрами (как resolveClient) — так работает дедуп при следующих оформлениях.
export async function updateClientAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      name,
      phone: phoneRaw ? phoneDigits(phoneRaw) || phoneRaw : null,
      internal_note: String(formData.get("note") ?? "").trim() || null,
    })
    .eq("id", id);
  if (error) console.error("[admin] client update error:", error.message);
  revalidatePath("/", "layout");
}

// ── Агенты (подэтап 4.5) ─────────────────────────────────────────────────────
// Реф-код: 6 строчных символов без похожих знаков (0/O, 1/l/I) — код диктуют
// вслух и набирают с телефона, путаница недопустима.
const REF_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomRefCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }
  return code;
}

// Новый агент: users (role=agent, БЕЗ auth_id — вход в систему ему не нужен,
// запись существует ради комиссии и статистики) + agents с уникальным реф-кодом.
// Комиссию не спрашиваем: default 300 000 ₫ задан в БД.
export async function createAgentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name) return { error: "Укажите имя агента." };

  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({
      role: "agent",
      name,
      phone: phone ? phoneDigits(phone) || phone : null,
    })
    .select("id")
    .single();
  if (userError || !user) {
    return { error: `Не удалось создать агента: ${userError?.message ?? "?"}` };
  }

  // Коллизия кода маловероятна (31^6 вариантов), но unique-индекс может её
  // поймать — тогда пробуем другой код, а не показываем ошибку человеку.
  let agentError: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase
      .from("agents")
      .insert({ user_id: user.id, ref_code: randomRefCode() });
    if (!error) {
      agentError = null;
      break;
    }
    agentError = error.message;
    if (error.code !== "23505") break; // не unique-конфликт — повтор не поможет
  }
  if (agentError) {
    // users-запись без agents бесполезна и замусорит базу — подчищаем.
    await supabase.from("users").delete().eq("id", user.id);
    return { error: `Не удалось создать агента: ${agentError}` };
  }

  revalidatePath("/", "layout");
  redirect("/admin/agents");
}

// Выключить/включить агента. Выключенный: лендинг /r/<код> перестаёт принимать
// гостей (мягкий редирект на /training), но история и награды остаются.
export async function toggleAgentActiveAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("agents")
    .update({ active: formData.get("active") !== "1" })
    .eq("id", id);
  if (error) console.error("[admin] agent toggle error:", error.message);
  revalidatePath("/", "layout");
}

// ── Члены клуба (подэтап 4.6) ────────────────────────────────────────────────
// Инвайт-ссылка: клиент купил абонемент офлайн → админ шлёт ему /invite/<token>
// в мессенджер → клиент ставит пароль и получает кабинет. Токен живёт 7 дней
// (default в БД), одноразовый (used_at). Повторное нажатие не плодит ссылки:
// живой неиспользованный токен переиспользуем.
export async function createInviteAction(formData: FormData) {
  const admin = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("invite_tokens")
    .select("id")
    .eq("client_id", clientId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (existing) return;

  // randomUUID без дефисов = 32 hex-символа; подобрать нереально, а в
  // мессенджере ссылка остаётся одной строкой.
  const { error } = await supabase.from("invite_tokens").insert({
    token: crypto.randomUUID().replace(/-/g, ""),
    client_id: clientId,
    created_by: admin.id,
  });
  if (error) console.error("[admin] invite create error:", error.message);
  revalidatePath("/", "layout");
}

// Сделать клиента членом клуба вручную. Обычно членство создаёт продажа
// абонемента; ручная кнопка — для случаев вроде «прошёл базовое обучение»
// (условия членства ещё уточняются у руководителя).
export async function addMemberAction(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("memberships")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (existing) return;

  const { error } = await supabase.from("memberships").insert({ client_id: clientId });
  if (error) console.error("[admin] membership insert error:", error.message);
  revalidatePath("/", "layout");
}

// «Перенести»: новая дата/время, статус живой — в ленте появится бейдж
// «Перенесена» (по rescheduled_at), но запись продолжает свой цикл.
export async function rescheduleAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("newDate") ?? "").trim();
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await updateBooking(id, {
    preferred_date: date,
    scheduled_time: String(formData.get("newTime") ?? "").trim() || null,
    rescheduled_at: new Date().toISOString(),
  });
}

// «Сохранить»: обновить поля уже подтверждённой записи, статус не трогаем.
export async function saveBookingAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await updateBooking(id, bookingFields(formData));
}

// «Закрепить/Открепить»: закреплённые записи висят сверху у инструкторов.
export async function togglePinAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await updateBooking(id, { pinned: formData.get("pinned") !== "1" });
}

// «Отменить»: клиент не придёт. Запись пропадает у инструкторов.
export async function cancelBookingAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await updateBooking(id, { status: "cancelled", pinned: false });
}
