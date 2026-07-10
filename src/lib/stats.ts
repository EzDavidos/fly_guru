import type { createClient } from "@/lib/supabase/server";

// Общий расчёт статистики инструктора — им пользуются главный экран кабинета
// (цифры за текущий месяц) и экран «Статистика» (произвольный период).
// Формула ЗП (архитектура, раздел 7): 10% от чеков моих сессий + 10% от
// проданных мной абонементов, У КОТОРЫХ ЕСТЬ ОПЛАТА (paid_at не пуст).
// Неоплаченные абонементы в ЗП не входят — показываются отдельной строкой.

export const SALARY_RATE = 0.1;

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
  salaryFromSubs: number;
  paidSubsCount: number; // абонементы, проданные мной и оплаченные в периоде
  unpaidSubsCount: number; // мои неоплаченные (за всё время) — ждут оплату
  unpaidSubsSum: number;
  clientBars: ClientBar[]; // по убыванию суммы
  byCategory: { category: string; amount: number }[]; // выручка по видам услуг
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

  // Проданные мной абонементы: оплаченные в периоде → в ЗП,
  // неоплаченные (когда-либо) → отдельной строкой.
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("price, paid_at")
    .eq("sold_by", instructorId);
  const subRows = subs ?? [];
  const paidInRange = subRows.filter(
    (s) => s.paid_at && s.paid_at >= range.fromIso && s.paid_at < range.toIso,
  );
  const unpaid = subRows.filter((s) => !s.paid_at);

  const paidSubsSum = paidInRange.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const salaryFromSessions = revenue * SALARY_RATE;
  const salaryFromSubs = paidSubsSum * SALARY_RATE;

  return {
    clientsCount: byClient.size,
    sessionsCount: rows.length,
    revenue,
    avgCheck: paidSessions.length ? revenue / paidSessions.length : 0,
    minutesWrittenOff,
    salary: salaryFromSessions + salaryFromSubs,
    salaryFromSessions,
    salaryFromSubs,
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
