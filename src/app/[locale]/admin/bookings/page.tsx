import type { Metadata } from "next";
import { Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { vnToday } from "@/lib/dates";
import {
  confirmBookingAction,
  saveBookingAction,
  togglePinAction,
  cancelBookingAction,
} from "../actions";

export const metadata: Metadata = { title: "Админка · Заявки" };

// Приём заявок с сайта. Админ созванивается, вносит время/возраст/вес и
// подтверждает — заявка становится «записью» у инструкторов.
// Полная лента со статусами, карточкой и фильтрами — подэтап 4.1.

interface BookingRow {
  id: string;
  client_name: string;
  phone: string;
  preferred_date: string | null;
  scheduled_time: string | null;
  age: number | null;
  weight: number | null;
  status: string;
  pinned: boolean;
  ref_code: string | null;
  internal_note: string | null;
  created_at: string;
  services: { name: string } | null;
  accepted: { name: string } | null;
}

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

// Редактируемые поля созвона + кнопки. Какие кнопки показать, зависит от статуса.
function BookingCard({ b, today }: { b: BookingRow; today: string }) {
  const isNew = b.status === "new";

  return (
    <div
      className={`rounded-2xl border bg-surface p-4 ${
        b.pinned ? "border-accent" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">
            {b.pinned && <span title="Закреплена">📌 </span>}
            {b.client_name}
          </p>
          <a href={`tel:${b.phone}`} className="text-sm text-primary underline">
            {b.phone}
          </a>
        </div>
        <Badge>{isNew ? "Новая" : "Запись"}</Badge>
      </div>

      <div className="mt-2 space-y-0.5 text-sm text-muted">
        {b.services?.name && <p>{b.services.name}</p>}
        {b.preferred_date && (
          <p>{b.preferred_date === today ? "Сегодня" : b.preferred_date}</p>
        )}
        {b.ref_code && <p>Реф-код: {b.ref_code} (скидка 200 000 ₫ на базовое)</p>}
        {b.accepted && <p className="text-primary">Принял: {b.accepted.name}</p>}
      </div>

      <form action={isNew ? confirmBookingAction : saveBookingAction} className="mt-3">
        <input type="hidden" name="id" value={b.id} />
        <input type="hidden" name="pinned" value={b.pinned ? "1" : "0"} />

        <div className="grid grid-cols-3 gap-2">
          <label className="text-xs text-muted">
            Время прихода
            <input
              type="text"
              name="scheduledTime"
              defaultValue={b.scheduled_time ?? ""}
              placeholder="10:30"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="text-xs text-muted">
            Возраст
            <input
              type="number"
              name="age"
              defaultValue={b.age ?? ""}
              min={1}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="text-xs text-muted">
            Вес, кг
            <input
              type="number"
              name="weight"
              defaultValue={b.weight ?? ""}
              min={1}
              className={`mt-1 ${inputClass}`}
            />
          </label>
        </div>
        <label className="mt-2 block text-xs text-muted">
          Заметка (видна инструкторам)
          <input
            type="text"
            name="note"
            defaultValue={b.internal_note ?? ""}
            className={`mt-1 ${inputClass}`}
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-strong"
          >
            {isNew ? "Подтвердить → в записи" : "Сохранить"}
          </button>
          {!isNew && (
            <button
              formAction={togglePinAction}
              className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
            >
              {b.pinned ? "Открепить" : "Закрепить"}
            </button>
          )}
          <button
            formAction={cancelBookingAction}
            className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-red-500 hover:text-red-500"
          >
            Отменить
          </button>
        </div>
      </form>
    </div>
  );
}

export default async function AdminBookingsPage() {
  const supabase = await createClient();
  const today = vnToday();

  // Открытые заявки + немного недавних закрытых (для контекста «что было»).
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, client_name, phone, preferred_date, scheduled_time, age, weight, status, pinned, ref_code, internal_note, created_at, services(name), accepted:users!accepted_by(name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const bookings = (data ?? []) as unknown as BookingRow[];
  const fresh = bookings.filter((b) => b.status === "new");
  // Записи: закреплённые сверху, дальше по ближайшей дате.
  const confirmed = bookings
    .filter((b) => b.status === "confirmed")
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (a.preferred_date ?? "9999").localeCompare(b.preferred_date ?? "9999"),
    );
  const closed = bookings
    .filter((b) => b.status === "done" || b.status === "cancelled")
    .slice(0, 10);

  return (
    <div>
      <h1 className="text-2xl font-bold">Актуальные заявки</h1>
      <p className="mt-1 text-sm text-muted">
        Созвонились с гостем → внесите время, возраст и вес → «Подтвердить».
        Запись появится у инструкторов; закреплённые — сверху их списка.
      </p>

      <h2 className="mt-8 text-lg font-bold">Новые ({fresh.length})</h2>
      {fresh.length === 0 && (
        <p className="mt-2 text-sm text-muted">Новых заявок нет.</p>
      )}
      <div className="mt-3 space-y-3">
        {fresh.map((b) => (
          <BookingCard key={b.id} b={b} today={today} />
        ))}
      </div>

      <h2 className="mt-10 text-lg font-bold">
        Записи у инструкторов ({confirmed.length})
      </h2>
      {confirmed.length === 0 && (
        <p className="mt-2 text-sm text-muted">Активных записей нет.</p>
      )}
      <div className="mt-3 space-y-3">
        {confirmed.map((b) => (
          <BookingCard key={b.id} b={b} today={today} />
        ))}
      </div>

      {closed.length > 0 && (
        <>
          <h2 className="mt-10 text-lg font-bold">Недавно закрытые</h2>
          <div className="mt-3 space-y-2">
            {closed.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-xl border border-line/70 bg-surface px-4 py-2 text-sm text-muted"
              >
                <span className="truncate">
                  {b.client_name} · {b.services?.name ?? "—"}
                </span>
                <span>{b.status === "done" ? "Проведена ✅" : "Отменена"}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
