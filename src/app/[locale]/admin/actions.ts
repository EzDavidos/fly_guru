"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { phoneDigits, phonesMatch } from "@/lib/phone";
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

  // Клиент: существующий из списка ИЛИ новый (имя + телефон). Перед созданием
  // ищем по телефону — та же логика гибкого сравнения цифр, что у инструктора,
  // чтобы не плодить дублей из-за «+84» против «84» и пробелов.
  let clientId = String(formData.get("clientId") ?? "");
  if (!clientId) {
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
    if (match) {
      clientId = match.id;
    } else {
      const { data: created, error } = await supabase
        .from("clients")
        .insert({
          name,
          phone: phoneDigits(phone) || phone,
          source: "offline",
          created_by: admin.id,
        })
        .select("id")
        .single();
      if (error || !created) {
        return { error: `Не удалось создать клиента: ${error?.message ?? "?"}` };
      }
      clientId = created.id;
    }
  }

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
