import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { vnCurrentMonth } from "@/lib/dates";

// «Моя статистика» за текущий месяц: клиенты, выручка, ЗП.
// Формула ЗП (архитектура, раздел 7): 10% от чеков моих сессий + 10% от
// проданных мной абонементов, У КОТОРЫХ ЕСТЬ ОПЛАТА (paid_at не пуст).
// Неоплаченные абонементы показываем отдельной строкой — в ЗП они не входят.

const SALARY_RATE = 0.1;

function vnd(n: number): string {
  return `${n.toLocaleString("ru-RU")} ₫`;
}

export default async function StatsPage() {
  const user = await getAppUser();
  if (!user) return null; // layout уже средиректил бы; страховка для типов

  const supabase = await createClient();
  const month = vnCurrentMonth();

  // Мои сессии за месяц. RLS и так отдаёт только мои + списания, но фильтруем
  // явно: списания чужих клиентов в мою статистику попадать не должны.
  const { data: sessions } = await supabase
    .from("sessions")
    .select("client_id, amount, minutes_used, subscription_id")
    .eq("instructor_id", user.id)
    .gte("date", month.fromDay)
    .lt("date", month.toDay);

  const rows = sessions ?? [];
  const clients = new Set(rows.map((r) => r.client_id).filter(Boolean));
  const revenue = rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const salaryFromSessions = revenue * SALARY_RATE;

  // Проданные мной абонементы. Оплаченные в этом месяце — в ЗП;
  // неоплаченные (когда-либо) — отдельной строкой «ожидают оплату».
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("price, paid_at, sold_at")
    .eq("sold_by", user.id);

  const subRows = subs ?? [];
  const paidThisMonth = subRows.filter(
    (s) => s.paid_at && s.paid_at >= month.fromIso && s.paid_at < month.toIso,
  );
  const unpaid = subRows.filter((s) => !s.paid_at);

  const paidSubsSum = paidThisMonth.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const unpaidSubsSum = unpaid.reduce((s, r) => s + Number(r.price ?? 0), 0);
  const salaryFromSubs = paidSubsSum * SALARY_RATE;
  const salary = salaryFromSessions + salaryFromSubs;

  return (
    <div>
      <h1 className="text-2xl font-bold">Моя статистика</h1>
      <p className="mt-1 text-sm capitalize text-muted">{month.label}</p>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">Клиенты</p>
          <p className="mt-1 text-3xl font-bold">{clients.size}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">Выручка</p>
          <p className="mt-1 text-xl font-bold">{vnd(revenue)}</p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl border-2 border-primary bg-surface p-5">
        <p className="text-sm text-muted">Моя ЗП за месяц</p>
        <p className="mt-1 text-3xl font-bold text-primary">{vnd(Math.round(salary))}</p>
        <div className="mt-3 space-y-1 text-sm text-muted">
          <p>10% от сессий: {vnd(Math.round(salaryFromSessions))}</p>
          <p>
            10% от оплаченных абонементов ({paidThisMonth.length} шт.):{" "}
            {vnd(Math.round(salaryFromSubs))}
          </p>
        </div>
      </div>

      {unpaid.length > 0 && (
        <div className="mt-3 rounded-2xl border border-dashed border-line bg-surface p-4 text-sm text-muted">
          Ожидают оплату — в ЗП не входят: {unpaid.length} абонемент(а) на{" "}
          {vnd(unpaidSubsSum)}. Когда админ отметит оплату, 10% попадут в расчёт.
        </div>
      )}
    </div>
  );
}
