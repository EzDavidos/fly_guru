"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";

// Server actions админки: приём заявок с сайта. Админ созванивается с гостем,
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

// «Подтвердить»: сохранить данные созвона и опубликовать запись инструкторам.
export async function confirmBookingAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await updateBooking(id, { ...bookingFields(formData), status: "confirmed" });
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
