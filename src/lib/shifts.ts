import type { createClient } from "@/lib/supabase/server";
import { vnMonth } from "@/lib/dates";

// Данные календаря за месяц — общий источник для админского и инструкторского
// кабинетов (цифры не должны расходиться). Собираем карту «день → смены +
// записи клиентов». Смена = выход инструктора (таблица shifts, пак H1);
// записи = подтверждённые заявки на этот день (bookings.preferred_date).

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface ShiftEntry {
  id: string;
  instructorId: string;
  name: string;
  note: string | null;
}

export interface DayBooking {
  id: string;
  clientName: string;
  time: string | null;
  serviceName: string | null;
  acceptedName: string | null;
}

export interface CalendarDay {
  shifts: ShiftEntry[];
  bookings: DayBooking[];
}

export interface StaffMember {
  id: string;
  name: string;
}

export interface MonthCalendar {
  // 'YYYY-MM-DD' → что в этот день; дни без событий в карте отсутствуют.
  days: Map<string, CalendarDay>;
  // Инструкторы + админ (кому можно ставить смену) — для панели дня у админа.
  staff: StaffMember[];
}

export async function getMonthCalendar(
  supabase: Supabase,
  ym: string,
): Promise<MonthCalendar> {
  const { fromDay, toDay } = vnMonth(ym);

  const [shiftsRes, bookingsRes, staffRes] = await Promise.all([
    supabase
      .from("shifts")
      .select("id, instructor_id, date, note, instructor:users!instructor_id(name)")
      .gte("date", fromDay)
      .lt("date", toDay),
    supabase
      .from("bookings")
      .select(
        "id, client_name, preferred_date, scheduled_time, services(name), accepted:users!accepted_by(name)",
      )
      .eq("status", "confirmed")
      .gte("preferred_date", fromDay)
      .lt("preferred_date", toDay),
    supabase
      .from("users")
      .select("id, name")
      .in("role", ["instructor", "admin"])
      .order("name"),
  ]);

  const days = new Map<string, CalendarDay>();
  const day = (d: string): CalendarDay => {
    let entry = days.get(d);
    if (!entry) {
      entry = { shifts: [], bookings: [] };
      days.set(d, entry);
    }
    return entry;
  };

  for (const s of shiftsRes.data ?? []) {
    const instr = s.instructor as unknown as { name: string } | null;
    day(s.date as string).shifts.push({
      id: s.id as string,
      instructorId: s.instructor_id as string,
      name: instr?.name ?? "?",
      note: (s.note as string | null) ?? null,
    });
  }

  for (const b of bookingsRes.data ?? []) {
    const svc = b.services as unknown as { name: string } | null;
    const acc = b.accepted as unknown as { name: string } | null;
    day(b.preferred_date as string).bookings.push({
      id: b.id as string,
      clientName: (b.client_name as string) ?? "Клиент",
      time: (b.scheduled_time as string | null) ?? null,
      serviceName: svc?.name ?? null,
      acceptedName: acc?.name ?? null,
    });
  }

  // Записи внутри дня — по времени (у кого нет времени, в конец).
  for (const d of days.values()) {
    d.bookings.sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  }

  return { days, staff: (staffRes.data ?? []) as StaffMember[] };
}

// Инициалы для компактной ячейки календаря: «Иван Петров» → «ИП», «Денис» → «Д».
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}
