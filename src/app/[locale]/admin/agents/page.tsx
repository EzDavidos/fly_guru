import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { vnd } from "@/lib/stats";
import { toggleAgentActiveAction } from "../actions";
import { AgentCreateForm } from "./AgentCreateForm";
import { CopyRefLink } from "./CopyRefLink";

export const metadata: Metadata = { title: "Админка · Агенты" };

// Агенты: партнёры с личной реф-ссылкой (гиды, отельеры). Приводят клиентов,
// получают фикс за каждого после выполненной услуги. Воронка на карточке:
// переходы по ссылке → клиенты → награды (ожидает / подтверждено).

interface AgentRow {
  id: string;
  ref_code: string;
  commission_fixed: number;
  active: boolean;
  user: { name: string; phone: string | null } | null;
}

interface AgentStats {
  visits: number;
  clients: number;
  pendingCount: number;
  pendingSum: number;
  confirmedCount: number;
  confirmedSum: number;
}

const EMPTY_STATS: AgentStats = {
  visits: 0,
  clients: 0,
  pendingCount: 0,
  pendingSum: 0,
  confirmedCount: 0,
  confirmedSum: 0,
};

function AgentCard({ a, stats }: { a: AgentRow; stats: AgentStats }) {
  const name = a.user?.name ?? "агент";
  return (
    <details
      className={`group rounded-2xl border border-line bg-surface ${a.active ? "" : "opacity-60"}`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">
            {name}{" "}
            <span className="font-normal text-muted">· {a.ref_code}</span>
          </p>
          <p className="truncate text-xs text-muted">
            {stats.visits} переходов · {stats.clients} клиентов ·{" "}
            {stats.confirmedCount} наград
          </p>
        </div>
        {!a.active && (
          <span className="rounded-full bg-line/60 px-2.5 py-1 text-[11px] font-semibold text-muted">
            Выключен
          </span>
        )}
        <span className="text-muted transition-transform group-open:rotate-180">▾</span>
      </summary>

      <div className="space-y-3 border-t border-line/70 p-4 pt-3">
        <CopyRefLink code={a.ref_code} />

        {/* Воронка: сколько людей открыли ссылку → сколько дошли до услуги. */}
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Переходы", value: String(stats.visits) },
            { label: "Клиенты", value: String(stats.clients) },
            { label: "Награды", value: String(stats.pendingCount + stats.confirmedCount) },
          ].map((m) => (
            <div key={m.label} className="rounded-xl border border-line/70 p-2">
              <p className="text-lg font-bold">{m.value}</p>
              <p className="text-[11px] text-muted">{m.label}</p>
            </div>
          ))}
        </div>

        <div className="space-y-0.5 text-sm text-muted">
          {a.user?.phone && (
            <p>
              <a href={`tel:${a.user.phone}`} className="text-primary underline">
                {a.user.phone}
              </a>
            </p>
          )}
          <p>
            Ожидает: <span className="font-bold text-ink">{vnd(stats.pendingSum)}</span>
            {stats.pendingCount > 0 && ` (${stats.pendingCount})`}
          </p>
          <p>
            Подтверждено:{" "}
            <span className="font-bold text-ink">{vnd(stats.confirmedSum)}</span>
            {stats.confirmedCount > 0 && ` (${stats.confirmedCount})`}
          </p>
          <p>Комиссия за клиента: {vnd(a.commission_fixed)}</p>
        </div>

        <form action={toggleAgentActiveAction}>
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="active" value={a.active ? "1" : "0"} />
          <button
            type="submit"
            className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
          >
            {a.active ? "Деактивировать" : "Включить обратно"}
          </button>
        </form>
      </div>
    </details>
  );
}

export default async function AdminAgentsPage() {
  const supabase = await createClient();

  const { data: agentsData } = await supabase
    .from("agents")
    .select("id, ref_code, commission_fixed, active, user:users!user_id(name, phone)");
  const agents = (agentsData ?? []) as unknown as AgentRow[];

  // Метрики тремя запросами на всех агентов сразу (не по одному на карточку),
  // агрегация в JS — на масштабе школы это дешевле и проще group by.
  const [visitsRes, clientsRes, rewardsRes] = await Promise.all([
    supabase.from("ref_visits").select("code").limit(100000),
    supabase
      .from("clients")
      .select("referrer_id")
      .eq("referrer_type", "agent"),
    supabase
      .from("referral_rewards")
      .select("referrer_id, amount, status")
      .eq("referrer_type", "agent"),
  ]);

  const statsById = new Map<string, AgentStats>();
  const stat = (id: string): AgentStats => {
    let s = statsById.get(id);
    if (!s) {
      s = { ...EMPTY_STATS };
      statsById.set(id, s);
    }
    return s;
  };

  const idByCode = new Map(agents.map((a) => [a.ref_code, a.id]));
  for (const v of visitsRes.data ?? []) {
    const id = idByCode.get(v.code as string);
    if (id) stat(id).visits += 1;
  }
  for (const c of clientsRes.data ?? []) {
    if (c.referrer_id) stat(c.referrer_id as string).clients += 1;
  }
  for (const r of rewardsRes.data ?? []) {
    const s = stat(r.referrer_id as string);
    if (r.status === "confirmed") {
      s.confirmedCount += 1;
      s.confirmedSum += (r.amount as number) ?? 0;
    } else {
      s.pendingCount += 1;
      s.pendingSum += (r.amount as number) ?? 0;
    }
  }

  // Активные сверху (по имени), выключенные серым внизу.
  const sorted = [...agents].sort(
    (a, b) =>
      Number(b.active) - Number(a.active) ||
      (a.user?.name ?? "").localeCompare(b.user?.name ?? "", "ru"),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Агенты</h1>
      <p className="mt-1 text-sm text-muted">
        Партнёры с личной реф-ссылкой. Награда начисляется после выполненной
        услуги приведённого клиента.
      </p>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <h2 className="mb-3 font-bold">Новый агент</h2>
        <AgentCreateForm />
      </section>

      {sorted.length === 0 && (
        <p className="mt-4 text-sm text-muted">Агентов пока нет.</p>
      )}
      <div className="mt-4 space-y-3">
        {sorted.map((a) => (
          <AgentCard key={a.id} a={a} stats={statsById.get(a.id) ?? EMPTY_STATS} />
        ))}
      </div>
    </div>
  );
}
