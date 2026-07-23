import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { vnToday } from "@/lib/dates";
import { acceptBookingAction, declineBookingAction } from "../actions";

// «Записи»: заявки, которые админ подтвердил (созвонился, внёс время/возраст/
// вес). Закреплённые админом — сверху. Любой инструктор может принять запись;
// принятую видно всем, но кнопка «Оформить» — только у принявшего.

interface BookingRow {
  id: string;
  client_name: string;
  phone: string;
  preferred_date: string | null;
  scheduled_time: string | null;
  age: number | null;
  weight: number | null;
  pinned: boolean;
  internal_note: string | null;
  accepted_by: string | null;
  services: { name: string; category: string } | null;
  accepted: { name: string } | null;
}

const actionButton =
  "inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-colors";

export default async function InstructorBookingsPage() {
  const supabase = await createClient();
  const today = vnToday();

  // Профиль и список записей не зависят друг от друга — грузим параллельно,
  // а не по очереди (каждый поход к базе в другом регионе стоит ~200 мс).
  const [user, { data }] = await Promise.all([
    getAppUser(),
    supabase
      .from("bookings")
      .select(
        "id, client_name, phone, preferred_date, scheduled_time, age, weight, pinned, internal_note, accepted_by, services(name, category), accepted:users!accepted_by(name)",
      )
      .eq("status", "confirmed")
      .order("pinned", { ascending: false })
      .order("preferred_date", { ascending: true, nullsFirst: false })
      .limit(50),
  ]);
  if (!user) return null; // layout уже средиректил бы; страховка для типов

  const bookings = (data ?? []) as unknown as BookingRow[];

  return (
    <div>
      <h1 className="text-2xl font-bold">Записи</h1>
      <p className="mt-1 text-sm text-muted">
        Подтверждённые админом клиенты. Берёте запись — жмите «Принять», после
        занятия — «Оформить».
      </p>

      {bookings.length === 0 && (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 text-center text-muted">
          Активных записей нет. 🌊
        </div>
      )}

      <div className="mt-6 space-y-3">
        {bookings.map((b) => {
          const mine = b.accepted_by === user.id;
          const takenByOther = Boolean(b.accepted_by) && !mine;

          return (
            <div
              key={b.id}
              className={`rounded-2xl border bg-surface p-4 ${
                b.pinned ? "border-accent" : "border-line"
              } ${takenByOther ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">
                    {b.pinned && <span title="Закреплена админом">📌 </span>}
                    {b.client_name}
                  </p>
                  <a href={`tel:${b.phone}`} className="text-sm text-primary underline">
                    {b.phone}
                  </a>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-lg font-bold text-primary">
                    {b.scheduled_time ?? "время?"}
                  </p>
                  {b.preferred_date && (
                    <p className="text-xs text-muted">
                      {b.preferred_date === today ? "Сегодня" : b.preferred_date}
                    </p>
                  )}
                </div>
              </div>

              {/* Услуга — отдельной крупной строкой: инструктору важнее всего
                  знать, что именно он катает, а раньше она терялась мелким
                  серым текстом рядом с возрастом (prompts 3, п.2). */}
              {b.services?.name && (
                <p className="mt-2 text-base font-semibold text-ink">{b.services.name}</p>
              )}

              <div className="mt-1 space-y-0.5 text-sm text-muted">
                <p>
                  {b.age != null && <>Возраст: {b.age}</>}
                  {b.age != null && b.weight != null && " · "}
                  {b.weight != null && <>Вес: {b.weight} кг</>}
                </p>
                {b.internal_note && <p className="italic">{b.internal_note}</p>}
              </div>

              {!b.accepted_by && (
                <form action={acceptBookingAction} className="mt-3">
                  <input type="hidden" name="id" value={b.id} />
                  <button
                    type="submit"
                    className={`${actionButton} bg-primary text-white hover:opacity-90`}
                  >
                    Принять
                  </button>
                </form>
              )}

              {mine && (
                <div className="mt-3 flex gap-2">
                  <Link
                    href={
                      b.services?.category === "subscription"
                        ? `/instructor/subscription?booking=${b.id}`
                        : `/instructor/record?booking=${b.id}`
                    }
                    className={`${actionButton} bg-accent text-white hover:bg-accent-strong`}
                  >
                    {b.services?.category === "subscription" ? "Продать абонемент" : "Записать клиента"}
                  </Link>
                  <form action={declineBookingAction} className="shrink-0">
                    <input type="hidden" name="id" value={b.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-line px-4 py-3 text-sm font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
                    >
                      Отказаться
                    </button>
                  </form>
                </div>
              )}

              {takenByOther && (
                <p className="mt-3 text-sm font-semibold text-muted">
                  Принял: {b.accepted?.name ?? "другой инструктор"}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
