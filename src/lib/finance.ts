import type { createClient } from "@/lib/supabase/server";
import { SESSION_RATE, SUBS_RATE, type StatsRange } from "@/lib/stats";

// Финансовая модель школы за период — питает вкладку «Расходы».
// Как делятся деньги (пачка правок №3, пак E):
//  • Marina Beach — 35% со ВСЕЙ выручки (сессии + оплаченные абонементы),
//    комиссия площадки.
//  • Инструктор — 15% с чека сессии + 10% с оплаченного абонемента (та же
//    цифра, что в «Расчёте месяца» и в кабинете инструктора).
//  • Дэвид + Ромчик (СММ) — 2% пополам (по 1%) со всего, что прошло через CRM:
//    сессии + оплаченные абонементы.
//  • Остаток — чистая прибыль школы, из неё вычитаем ручные расходы (таблица
//    expenses: аренда, топливо, инвентарь…).

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
  instructorPay: number; // 15% сессий + 10% абонементов
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
  const [sessionsRes, subsRes, expensesRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("amount")
      .gte("date", range.fromDay)
      .lt("date", range.toDay),
    supabase
      .from("subscriptions")
      .select("price, paid_at")
      .not("paid_at", "is", null)
      .gte("paid_at", range.fromIso)
      .lt("paid_at", range.toIso),
    supabase
      .from("expenses")
      .select("id, date, category, amount, comment")
      .gte("date", range.fromDay)
      .lt("date", range.toDay)
      .order("amount", { ascending: false }),
  ]);

  const sessionsRevenue = (sessionsRes.data ?? []).reduce(
    (s, r) => s + Number(r.amount ?? 0),
    0,
  );
  const paidSubsRevenue = (subsRes.data ?? []).reduce(
    (s, r) => s + Number(r.price ?? 0),
    0,
  );
  const revenue = sessionsRevenue + paidSubsRevenue;

  const marina = revenue * MARINA_RATE;
  const instructorPay =
    sessionsRevenue * SESSION_RATE + paidSubsRevenue * SUBS_RATE;
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
    crmCut,
    crmEach,
    autoTotal,
    manualExpenses,
    manualTotal,
    netProfit: revenue - autoTotal - manualTotal,
  };
}
