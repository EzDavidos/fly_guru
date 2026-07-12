"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { sendInstructorsBookingAlert } from "@/lib/telegram";

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
