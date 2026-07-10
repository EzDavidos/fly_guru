import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui";
import { vnToday } from "@/lib/dates";

// Экран «Заявки»: что пришло с сайта и ждёт обработки — на сегодня и ближайшие дни.

const STATUS_LABEL: Record<string, string> = {
  new: "Новая",
  contacted: "На связи",
  confirmed: "Подтверждена",
};

interface BookingRow {
  id: string;
  client_name: string;
  phone: string;
  preferred_date: string | null;
  status: string;
  ref_code: string | null;
  internal_note: string | null;
  services: { name: string } | null;
}

export default async function InstructorBookingsPage() {
  const supabase = await createClient();

  // Открытые заявки: свежие и с ближайшими датами. Прошедшие даты тоже
  // показываем (их надо либо оформить, либо отменить в админке) — но ниже.
  const { data } = await supabase
    .from("bookings")
    .select(
      "id, client_name, phone, preferred_date, status, ref_code, internal_note, services(name)",
    )
    .in("status", ["new", "contacted", "confirmed"])
    .order("preferred_date", { ascending: true, nullsFirst: false })
    .limit(50);

  const bookings = (data ?? []) as unknown as BookingRow[];
  const today = vnToday();

  return (
    <div>
      <h1 className="text-2xl font-bold">Заявки</h1>
      <p className="mt-1 text-sm text-muted">
        Открытые заявки с сайта. Провели занятие — жмите «Оформить».
      </p>

      {bookings.length === 0 && (
        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 text-center text-muted">
          Открытых заявок нет. 🌊
        </div>
      )}

      <div className="mt-6 space-y-3">
        {bookings.map((b) => (
          <div key={b.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold">{b.client_name}</p>
                <a href={`tel:${b.phone}`} className="text-sm text-primary underline">
                  {b.phone}
                </a>
              </div>
              <Badge>{STATUS_LABEL[b.status] ?? b.status}</Badge>
            </div>

            <div className="mt-2 space-y-0.5 text-sm text-muted">
              {b.services?.name && <p>{b.services.name}</p>}
              {b.preferred_date && (
                <p>
                  {b.preferred_date === today ? "Сегодня" : b.preferred_date}
                </p>
              )}
              {b.ref_code && <p>Реф-код: {b.ref_code} (скидка 200 000 ₫ на базовое)</p>}
              {b.internal_note && <p className="italic">{b.internal_note}</p>}
            </div>

            <Link
              href={`/instructor/record?booking=${b.id}`}
              className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
            >
              Оформить
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
