import type { createClient } from "@/lib/supabase/server";

// Общий расчёт статистики инструктора — им пользуются главный экран кабинета
// (цифры за текущий месяц) и экран «Статистика» (произвольный период).
//
// Формула ЗП инструктора (архитектура, раздел 7) — три слагаемых:
//   • 15% от чеков МОИХ сессий;
//   • 200 000 ₫ × число моих выходов (смен из календаря) за период;
//   • доля абонементного котла: 10% от абонементов, ПРОДАННЫХ ИНСТРУКТОРАМИ
//     и оплаченных в периоде (paid_at не пуст), поделённые ПОРОВНУ между
//     всеми инструкторами — неважно, кто именно продал.
// Неоплаченные абонементы в ЗП не входят — показываются отдельной строкой.
//
// Админ — босс, а не наёмный: ЗП у него нет вообще. Со своей сессии он платит
// только Marina Beach (35%) и 2% CRM, остальное оставляет себе (см. lib/finance).
// Поэтому для роли admin все три слагаемых — нули, а его продажи абонементов
// в котёл инструкторов не идут.

export const SESSION_RATE = 0.15; // доля инструктора с чека занятия
export const SUBS_RATE = 0.1; // доля с абонемента — в общий котёл инструкторов
export const SHIFT_PAY = 200_000; // ₫ за один выход (смену), независимо от клиентов

export type StaffRole = "instructor" | "admin";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Границы периода — форма как у vnCurrentMonth()/vnPeriod() из lib/dates.
export interface StatsRange {
  fromDay: string; // date-колонки: date >= fromDay
  toDay: string; //                 date <  toDay
  fromIso: string; // timestamptz (paid_at): >= fromIso
  toIso: string; //                          <  toIso
}

// Один клиент = один бар на графике: сколько он принёс за период.
export interface ClientBar {
  clientId: string;
  name: string;
  amount: number; // сумма чеков
  sessions: number; // сколько занятий
  minutes: number; // списано минут с абонемента
}

export interface InstructorStats {
  clientsCount: number;
  sessionsCount: number;
  revenue: number; // сумма чеков моих сессий за период
  avgCheck: number; // средний чек по сессиям с деньгами (списания не считаем)
  minutesWrittenOff: number;
  salary: number;
  salaryFromSessions: number;
  salaryFromShifts: number; // 200 000 ₫ × мои выходы
  salaryFromSubs: number; // моя доля котла (не зависит от того, кто продал)
  shiftsCount: number; // мои смены за период
  subsPool: number; // весь котёл за период (10% продаж инструкторов) — справка
  instructorsCount: number; // на скольких делится котёл
  paidSubsCount: number; // абонементы, проданные мной и оплаченные в периоде
  unpaidSubsCount: number; // мои неоплаченные (за всё время) — ждут оплату
  unpaidSubsSum: number;
  clientBars: ClientBar[]; // по убыванию суммы
  byCategory: { category: string; amount: number }[]; // выручка по видам услуг
}

// Кто в доле: все с ролью instructor. Флага «активен» у users нет — уволенного
// инструктора админ удаляет из базы, иначе он продолжит делить котёл.
// Инструктору этот список отдаёт политика users_select_staff (миграция 0015).
export async function getInstructorIds(supabase: Supabase): Promise<string[]> {
  const { data } = await supabase.from("users").select("id").eq("role", "instructor");
  return (data ?? []).map((u) => u.id as string);
}

interface SessionRow {
  client_id: string | null;
  amount: number | null;
  minutes_used: number | null;
  clients: { name: string } | null;
  services: { category: string } | null;
}

export async function getInstructorStats(
  supabase: Supabase,
  instructorId: string,
  range: StatsRange,
  role: StaffRole = "instructor",
): Promise<InstructorStats> {
  // Мои сессии за период. RLS отдаёт ещё и чужие списания — фильтруем явно.
  const { data } = await supabase
    .from("sessions")
    .select("client_id, amount, minutes_used, clients(name), services(category)")
    .eq("instructor_id", instructorId)
    .gte("date", range.fromDay)
    .lt("date", range.toDay);
  const rows = (data ?? []) as unknown as SessionRow[];

  const revenue = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const minutesWrittenOff = rows.reduce((s, r) => s + (r.minutes_used ?? 0), 0);
  const paidSessions = rows.filter((r) => Number(r.amount ?? 0) > 0);

  // Группируем по клиенту — для баров «каждый клиент отдельно».
  const byClient = new Map<string, ClientBar>();
  for (const r of rows) {
    if (!r.client_id) continue;
    const bar = byClient.get(r.client_id) ?? {
      clientId: r.client_id,
      name: r.clients?.name ?? "Без имени",
      amount: 0,
      sessions: 0,
      minutes: 0,
    };
    bar.amount += Number(r.amount ?? 0);
    bar.sessions += 1;
    bar.minutes += r.minutes_used ?? 0;
    byClient.set(r.client_id, bar);
  }
  const clientBars = [...byClient.values()].sort((a, b) => b.amount - a.amount);

  // Выручка по категориям услуг. У списаний service_id пуст — это «абонемент».
  const byCategoryMap = new Map<string, number>();
  for (const r of rows) {
    const amount = Number(r.amount ?? 0);
    if (amount <= 0) continue;
    const cat = r.services?.category ?? "other";
    byCategoryMap.set(cat, (byCategoryMap.get(cat) ?? 0) + amount);
  }
  const byCategory = [...byCategoryMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const [{ data: subs }, { data: poolSubs }, { count: shiftsRaw }, instructorIds] =
    await Promise.all([
      // Проданные мной — для справки «продал N» и строки «ждут оплату».
      supabase.from("subscriptions").select("price, paid_at").eq("sold_by", instructorId),
      // Котёл: всё, что оплатили в периоде (чьё именно — отсеем ниже по sold_by).
      supabase
        .from("subscriptions")
        .select("price, sold_by")
        .not("paid_at", "is", null)
        .gte("paid_at", range.fromIso)
        .lt("paid_at", range.toIso),
      supabase
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .eq("instructor_id", instructorId)
        .gte("date", range.fromDay)
        .lt("date", range.toDay),
      getInstructorIds(supabase),
    ]);

  const subRows = subs ?? [];
  const paidInRange = subRows.filter(
    (s) => s.paid_at && s.paid_at >= range.fromIso && s.paid_at < range.toIso,
  );
  const unpaid = subRows.filter((s) => !s.paid_at);

  // Котёл наполняют ТОЛЬКО продажи инструкторов: абонемент, проданный админом,
  // остаётся боссу — инструкторам с него ничего не идёт.
  const instructorSet = new Set(instructorIds);
  const poolBase = (poolSubs ?? [])
    .filter((s) => s.sold_by && instructorSet.has(s.sold_by as string))
    .reduce((s, r) => s + Number(r.price ?? 0), 0);
  const subsPool = poolBase * SUBS_RATE;

  const shiftsCount = shiftsRaw ?? 0;
  const isInstructor = role === "instructor"; // у босса ЗП нет — все слагаемые нули
  const salaryFromSessions = isInstructor ? revenue * SESSION_RATE : 0;
  const salaryFromShifts = isInstructor ? shiftsCount * SHIFT_PAY : 0;
  const salaryFromSubs =
    isInstructor && instructorIds.length > 0 ? subsPool / instructorIds.length : 0;

  return {
    clientsCount: byClient.size,
    sessionsCount: rows.length,
    revenue,
    avgCheck: paidSessions.length ? revenue / paidSessions.length : 0,
    minutesWrittenOff,
    salary: salaryFromSessions + salaryFromShifts + salaryFromSubs,
    salaryFromSessions,
    salaryFromShifts,
    salaryFromSubs,
    shiftsCount,
    subsPool,
    instructorsCount: instructorIds.length,
    paidSubsCount: paidInRange.length,
    unpaidSubsCount: unpaid.length,
    unpaidSubsSum: unpaid.reduce((s, r) => s + Number(r.price ?? 0), 0),
    clientBars,
    byCategory,
  };
}

// Форматирование донгов: «1 500 000 ₫».
export function vnd(n: number): string {
  return `${Math.round(n).toLocaleString("ru-RU")} ₫`;
}
