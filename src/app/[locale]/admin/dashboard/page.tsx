import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { vnMonth } from "@/lib/dates";
import { vnd } from "@/lib/stats";
import { MonthSwitcher, resolveYm } from "../MonthSwitcher";

export const metadata: Metadata = { title: "Админка · Дашборд" };

// Дашборд: «как дела у школы» за выбранный месяц. Всё read-only.
// Правило денег: доход существует только после факта оплаты — неоплаченные
// абонементы в итоги не входят, показываются справочной строкой.

const CATEGORY_LABEL: Record<string, string> = {
  training: "Обучение",
  tandem: "Тандемы",
  rental: "Прокат",
  tour: "Экскурсии",
  subscription: "Абонементы",
  extra: "Прочее",
};

const STATUS_LABEL: Record<string, string> = {
  new: "Новые",
  contacted: "В обработке",
  confirmed: "Подтверждены",
  done: "Выполнены",
  cancelled: "Отменены",
  archived: "В архиве",
};

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

// Строка «название … значение» с точечным заполнителем.
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span className="min-w-0 truncate text-muted">{label}</span>
      <span className="min-w-4 flex-1 border-b border-dotted border-line" />
      <span className="shrink-0 font-semibold">{value}</span>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-3 space-y-1.5">{children}</div>
    </section>
  );
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const ym = resolveYm(m);
  const month = vnMonth(ym);

  const supabase = await createClient();
  const [sessionsRes, paidSubsRes, unpaidSubsRes, clientsRes, bookingsRes] =
    await Promise.all([
      supabase
        .from("sessions")
        .select(
          "amount, service:services!service_id(name, category), instructor:users!instructor_id(name)",
        )
        .gte("date", month.fromDay)
        .lt("date", month.toDay),
      supabase
        .from("subscriptions")
        .select("price")
        .gte("paid_at", month.fromIso)
        .lt("paid_at", month.toIso),
      // Дебиторка всей школы (не месяца): проданные, но неоплаченные.
      supabase.from("subscriptions").select("price").is("paid_at", null),
      supabase
        .from("clients")
        .select("id, referrer_type, referrer_id")
        .gte("created_at", month.fromIso)
        .lt("created_at", month.toIso),
      supabase
        .from("bookings")
        .select("status, src, ref_code")
        .gte("created_at", month.fromIso)
        .lt("created_at", month.toIso),
    ]);

  const sessions = (sessionsRes.data ?? []) as unknown as {
    amount: number | null;
    service: { name: string; category: string } | null;
    instructor: { name: string } | null;
  }[];
  const sessionsSum = sessions.reduce((s, r) => s + (r.amount ?? 0), 0);
  const paidSubsSum = (paidSubsRes.data ?? []).reduce((s, r) => s + (r.price ?? 0), 0);
  const unpaid = unpaidSubsRes.data ?? [];
  const unpaidSum = unpaid.reduce((s, r) => s + (r.price ?? 0), 0);
  const revenue = sessionsSum + paidSubsSum;

  // Выручка по категориям: сессии по категории услуги + оплаченные абонементы
  // отдельной строкой — сумма строк сходится с общей выручкой.
  const byCategory = new Map<string, number>();
  for (const r of sessions) {
    const cat = r.service?.category ?? "extra";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + (r.amount ?? 0));
  }
  if (paidSubsSum > 0) {
    byCategory.set("subscription", (byCategory.get("subscription") ?? 0) + paidSubsSum);
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  // Топ услуг по количеству проведённых сессий.
  const byService = new Map<string, number>();
  for (const r of sessions) {
    const name = r.service?.name ?? "без услуги";
    byService.set(name, (byService.get(name) ?? 0) + 1);
  }
  const topServices = [...byService.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Сессии и выручка по инструкторам.
  const byInstructor = new Map<string, { count: number; sum: number }>();
  for (const r of sessions) {
    const name = r.instructor?.name ?? "—";
    const acc = byInstructor.get(name) ?? { count: 0, sum: 0 };
    acc.count += 1;
    acc.sum += r.amount ?? 0;
    byInstructor.set(name, acc);
  }
  const instructors = [...byInstructor.entries()].sort((a, b) => b[1].sum - a[1].sum);

  // Заявки: воронка по статусам + источники (реф-ссылка / метки src / прямые).
  const bookings = bookingsRes.data ?? [];
  const byStatus = new Map<string, number>();
  const bySource = new Map<string, number>();
  for (const b of bookings) {
    byStatus.set(b.status as string, (byStatus.get(b.status as string) ?? 0) + 1);
    const source = b.ref_code
      ? "по реф-ссылке"
      : b.src
        ? `src: ${b.src}`
        : "прямые";
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
  }
  const sources = [...bySource.entries()].sort((a, b) => b[1] - a[1]);

  // Топ агентов месяца по приведённым клиентам.
  const newClients = clientsRes.data ?? [];
  const byAgent = new Map<string, number>();
  for (const c of newClients) {
    if (c.referrer_type === "agent" && c.referrer_id) {
      byAgent.set(c.referrer_id, (byAgent.get(c.referrer_id) ?? 0) + 1);
    }
  }
  const topAgentIds = [...byAgent.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const agentNames = new Map<string, string>();
  if (topAgentIds.length) {
    const { data: agentsData } = await supabase
      .from("agents")
      .select("id, user:users!user_id(name)")
      .in("id", topAgentIds.map(([id]) => id));
    for (const a of agentsData ?? []) {
      agentNames.set(
        a.id as string,
        (a.user as unknown as { name: string } | null)?.name ?? "агент",
      );
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Дашборд</h1>

      <MonthSwitcher ym={ym} basePath="/admin/dashboard" />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-2xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">Выручка · только оплаченное</p>
          <p className="mt-1 text-3xl font-bold text-primary">{vnd(revenue)}</p>
          <div className="mt-3 space-y-1.5">
            <Row label={`Сессии (${sessions.length})`} value={vnd(sessionsSum)} />
            <Row
              label={`Оплачено абонементов (${(paidSubsRes.data ?? []).length}) · MRR`}
              value={vnd(paidSubsSum)}
            />
          </div>
          {unpaid.length > 0 && (
            <p className="mt-3 border-t border-line/70 pt-2 text-xs text-muted">
              Ожидают оплату: {unpaid.length} абонемент(а) на {vnd(unpaidSum)} —
              в итоги не входят (всего по школе).
            </p>
          )}
        </div>

        <StatCard label="Новые клиенты" value={String(newClients.length)} />
        <StatCard label="Заявки за месяц" value={String(bookings.length)} />
      </div>

      <div className="mt-3 space-y-3">
        <Panel title="Выручка по категориям">
          {categories.length === 0 && <p className="text-sm text-muted">Пока пусто.</p>}
          {categories.map(([cat, sum]) => (
            <Row key={cat} label={CATEGORY_LABEL[cat] ?? cat} value={vnd(sum)} />
          ))}
        </Panel>

        <Panel title="Топ услуг по количеству">
          {topServices.length === 0 && <p className="text-sm text-muted">Пока пусто.</p>}
          {topServices.map(([name, count]) => (
            <Row key={name} label={name} value={String(count)} />
          ))}
        </Panel>

        <Panel title="Заявки: статусы">
          {bookings.length === 0 && <p className="text-sm text-muted">Пока пусто.</p>}
          {Object.entries(STATUS_LABEL)
            .filter(([s]) => byStatus.has(s))
            .map(([s, label]) => (
              <Row key={s} label={label} value={String(byStatus.get(s))} />
            ))}
        </Panel>

        <Panel title="Заявки: источники">
          {sources.length === 0 && <p className="text-sm text-muted">Пока пусто.</p>}
          {sources.map(([label, count]) => (
            <Row key={label} label={label} value={String(count)} />
          ))}
        </Panel>

        <Panel title="Инструкторы">
          {instructors.length === 0 && <p className="text-sm text-muted">Пока пусто.</p>}
          {instructors.map(([name, s]) => (
            <Row key={name} label={`${name} · ${s.count} сессий`} value={vnd(s.sum)} />
          ))}
        </Panel>

        {topAgentIds.length > 0 && (
          <Panel title="Топ агентов по клиентам">
            {topAgentIds.map(([id, count]) => (
              <Row key={id} label={agentNames.get(id) ?? "агент"} value={String(count)} />
            ))}
          </Panel>
        )}
      </div>
    </div>
  );
}
