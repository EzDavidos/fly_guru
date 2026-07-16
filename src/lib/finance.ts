import type { createClient } from "@/lib/supabase/server";
import {
  SESSION_RATE,
  SHIFT_PAY,
  SUBS_RATE,
  getInstructorIds,
  type StatsRange,
} from "@/lib/stats";

// Финансовая модель школы за период — питает вкладку «Расходы».
// Как делятся деньги (пачка правок №3, паки E + H2):
//  • Marina Beach — 35% со ВСЕЙ выручки (сессии + оплаченные абонементы),
//    комиссия площадки.
//  • ЗП инструкторов — 15% с чеков ИХ сессий + 200 000 ₫ за каждый их выход
//    + 15% с абонементов, проданных ИМИ (тот же котёл, что в «Расчёте месяца»
//    и в кабинете инструктора, только целиком, а не подушевой долей).
//  • Дэвид + Ромчик (СММ) — 2% пополам (по 1%) со всего, что прошло через CRM:
//    сессии + оплаченные абонементы.
//  • Остаток — чистая прибыль, деньги босса, из неё вычитаем ручные расходы
//    (таблица expenses: аренда, топливо, инвентарь…).
//
// Важно: сессии и абонементы АДМИНА в ЗП не попадают — он босс и оставляет
// себе всё, кроме 35% Marina и 2% CRM. Его деньги и есть эта чистая прибыль.
// Если считать 15% со всей выручки без разбора, вкладка покажет фантомный
// расход и занизит прибыль.

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const MARINA_RATE = 0.35; // Marina Beach — со всей выручки
export const CRM_RATE = 0.02; // Дэвид + Ромчик — с сессий + абонементов (пополам)

export interface ExpenseRow {
  id: string;
  date: string;
  category: string | null;
  amount: number;
  comment: string | null;
}

export interface Finance {
  sessionsRevenue: number; // чеки занятий за период
  paidSubsRevenue: number; // абонементы, оплаченные в периоде
  revenue: number; // сумма выручки
  marina: number; // 35% от всей выручки
  instructorPay: number; // вся ЗП инструкторов (три слагаемых ниже)
  instructorSessionPay: number; // 15% с чеков сессий инструкторов
  instructorShiftPay: number; // 200 000 ₫ × выходы инструкторов
  instructorSubsPay: number; // 15% с абонементов, проданных инструкторами
  instructorShifts: number; // сколько выходов оплачиваем
  crmCut: number; // 2% с сессий + абонементов
  crmEach: number; // доля одного (Дэвид / Ромчик) — половина crmCut
  autoTotal: number; // сумма основных (авто) расходов
  manualExpenses: ExpenseRow[]; // ручные расходы за период (по убыванию суммы)
  manualTotal: number; // их сумма
  netProfit: number; // выручка − авто − ручные
}

export async function getFinance(
  supabase: Supabase,
  range: StatsRange,
): Promise<Finance> {
  const [sessionsRes, subsRes, expensesRes, shiftsRes, instructorIds] =
    await Promise.all([
      supabase
        .from("sessions")
        .select("amount, instructor_id")
        .gte("date", range.fromDay)
        .lt("date", range.toDay),
      supabase
        .from("subscriptions")
        .select("price, sold_by")
        .not("paid_at", "is", null)
        .gte("paid_at", range.fromIso)
        .lt("paid_at", range.toIso),
      supabase
        .from("expenses")
        .select("id, date, category, amount, comment")
        .gte("date", range.fromDay)
        .lt("date", range.toDay)
        .order("amount", { ascending: false }),
      supabase
        .from("shifts")
        .select("instructor_id")
        .gte("date", range.fromDay)
        .lt("date", range.toDay),
      getInstructorIds(supabase),
    ]);

  const sessions = sessionsRes.data ?? [];
  const subs = subsRes.data ?? [];
  const sessionsRevenue = sessions.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const paidSubsRevenue = subs.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const revenue = sessionsRevenue + paidSubsRevenue;

  // Выручка школы — вся; а вот ЗП платим только за работу инструкторов.
  // Всё, что откатал/продал сам админ, мимо ЗП — это его прибыль.
  const isInstructor = new Set(instructorIds);
  const instructorSessionsRevenue = sessions
    .filter((r) => r.instructor_id && isInstructor.has(r.instructor_id as string))
    .reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const instructorSubsRevenue = subs
    .filter((r) => r.sold_by && isInstructor.has(r.sold_by as string))
    .reduce((s, r) => s + Number(r.price ?? 0), 0);
  const instructorShifts = (shiftsRes.data ?? []).filter(
    (r) => r.instructor_id && isInstructor.has(r.instructor_id as string),
  ).length;

  const marina = revenue * MARINA_RATE;
  const instructorSessionPay = instructorSessionsRevenue * SESSION_RATE;
  const instructorShiftPay = instructorShifts * SHIFT_PAY;
  const instructorSubsPay = instructorSubsRevenue * SUBS_RATE;
  const instructorPay = instructorSessionPay + instructorShiftPay + instructorSubsPay;
  const crmCut = revenue * CRM_RATE;
  const crmEach = crmCut / 2;
  const autoTotal = marina + instructorPay + crmCut;

  const manualExpenses = (expensesRes.data ?? []).map((e) => ({
    id: e.id as string,
    date: e.date as string,
    category: (e.category as string | null) ?? null,
    amount: Number(e.amount ?? 0),
    comment: (e.comment as string | null) ?? null,
  }));
  const manualTotal = manualExpenses.reduce((s, e) => s + e.amount, 0);

  return {
    sessionsRevenue,
    paidSubsRevenue,
    revenue,
    marina,
    instructorPay,
    instructorSessionPay,
    instructorShiftPay,
    instructorSubsPay,
    instructorShifts,
    crmCut,
    crmEach,
    autoTotal,
    manualExpenses,
    manualTotal,
    netProfit: revenue - autoTotal - manualTotal,
  };
}
