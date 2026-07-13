import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { vnToday } from "@/lib/dates";
import { vnd } from "@/lib/stats";
import { togglePaidAction } from "../actions";
import {
  SellSubscriptionForm,
  AdjustMinutesForm,
  ConfirmSubmit,
} from "./SubscriptionForms";

export const metadata: Metadata = { title: "Админка · Абонементы" };

// Абонементы: остаток минут (всего + корректировки − списания), отметка
// оплаты (главный финансовый рубильник: без paid_at абонемент не входит
// ни в выручку, ни в комиссию), продажа от админа, корректировки с логом.

interface SubRow {
  id: string;
  total_minutes: number;
  price: number;
  sold_at: string;
  expires_at: string | null;
  status: string;
  paid_at: string | null;
  clients: { name: string } | null;
  seller: { name: string } | null;
}

interface HistoryItem {
  at: string;
  text: string;
}

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

// Короткая дата для карточек: «12.07.2026» по времени Нячанга.
function fmtDay(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso));
}

function SubscriptionCard({
  s,
  left,
  history,
  today,
}: {
  s: SubRow;
  left: number;
  history: HistoryItem[];
  today: string;
}) {
  const expired =
    s.status === "expired" ||
    (s.expires_at !== null && new Date(s.expires_at) < new Date());

  const statusLabel = expired
    ? { text: "Истёк", cls: "bg-line text-muted" }
    : s.status === "used_up"
      ? { text: "Минуты кончились", cls: "bg-line text-muted" }
      : { text: `${left} мин`, cls: "bg-primary/10 text-primary" };

  return (
    <details className="group rounded-2xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{s.clients?.name ?? "Без клиента"}</p>
          <p className="truncate text-xs text-muted">
            {fmtDay(s.sold_at)} · {vnd(s.price)} · продал {s.seller?.name ?? "—"}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            s.paid_at
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-amber-500/10 text-amber-600"
          }`}
        >
          {s.paid_at ? `Оплачен ${fmtDay(s.paid_at)}` : "Ожидает оплаты"}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusLabel.cls}`}>
          {statusLabel.text}
        </span>
        <span className="text-muted transition-transform group-open:rotate-180">▾</span>
      </summary>

      <div className="border-t border-line/70 p-4 pt-3">
        <p className="text-sm text-muted">
          Остаток <span className="font-bold text-ink">{left} мин</span> из{" "}
          {s.total_minutes} · истекает {fmtDay(s.expires_at)}
        </p>

        {/* Отметка оплаты */}
        <form action={togglePaidAction} className="mt-3">
          <input type="hidden" name="id" value={s.id} />
          {s.paid_at ? (
            <>
              <input type="hidden" name="set" value="0" />
              <ConfirmSubmit
                message="Снять отметку оплаты? Абонемент выпадет из выручки и комиссии за месяц оплаты."
                className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-red-500 hover:text-red-500"
              >
                Снять отметку оплаты
              </ConfirmSubmit>
            </>
          ) : (
            <div className="flex items-end gap-2">
              <input type="hidden" name="set" value="1" />
              <label className="w-40 text-xs text-muted">
                Дата оплаты
                <input
                  type="date"
                  name="paidDate"
                  defaultValue={today}
                  max={today}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <button
                type="submit"
                className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                Отметить оплату
              </button>
            </div>
          )}
        </form>

        {/* Корректировка минут */}
        <AdjustMinutesForm subscriptionId={s.id} />

        {/* История: списания + корректировки */}
        {history.length > 0 && (
          <div className="mt-4 border-t border-line/70 pt-3">
            <p className="text-xs font-semibold text-muted">История минут</p>
            <ul className="mt-1 space-y-1 text-xs text-muted">
              {history.map((h, i) => (
                <li key={i}>{h.text}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f = "" } = await searchParams;
  const showAll = f === "all";
  const today = vnToday();

  const supabase = await createClient();
  let subsQuery = supabase
    .from("subscriptions")
    .select(
      "id, total_minutes, price, sold_at, expires_at, status, paid_at, clients(name), seller:users!sold_by(name)",
    )
    .order("sold_at", { ascending: false })
    .limit(100);
  if (!showAll) subsQuery = subsQuery.eq("status", "active");

  const [subsRes, clientsRes, staffRes] = await Promise.all([
    subsQuery,
    supabase.from("clients").select("id, name, phone").order("name").limit(1000),
    supabase
      .from("users")
      .select("id, name")
      .in("role", ["instructor", "admin"])
      .order("name"),
  ]);

  const subs = (subsRes.data ?? []) as unknown as SubRow[];
  const ids = subs.map((s) => s.id);

  // Балансы и история — двумя батч-запросами на весь список сразу.
  const [usedRes, adjRes] = ids.length
    ? await Promise.all([
        supabase
          .from("sessions")
          .select("subscription_id, minutes_used, date, instructor:users!instructor_id(name)")
          .in("subscription_id", ids),
        supabase
          .from("subscription_adjustments")
          .select("subscription_id, delta_minutes, comment, created_at, author:users!created_by(name)")
          .in("subscription_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  const usedBySub = new Map<string, number>();
  const historyBySub = new Map<string, HistoryItem[]>();
  const push = (id: string, item: HistoryItem) => {
    historyBySub.set(id, [...(historyBySub.get(id) ?? []), item]);
  };

  for (const r of usedRes.data ?? []) {
    const id = r.subscription_id as string;
    usedBySub.set(id, (usedBySub.get(id) ?? 0) + (r.minutes_used ?? 0));
    const instructor = (r.instructor as unknown as { name: string } | null)?.name ?? "?";
    push(id, {
      at: r.date as string,
      text: `${fmtDay(r.date as string)} · списание ${r.minutes_used ?? 0} мин — ${instructor}`,
    });
  }
  const adjBySub = new Map<string, number>();
  for (const r of adjRes.data ?? []) {
    const id = r.subscription_id as string;
    const delta = (r.delta_minutes as number) ?? 0;
    adjBySub.set(id, (adjBySub.get(id) ?? 0) + delta);
    const author = (r.author as unknown as { name: string } | null)?.name ?? "?";
    push(id, {
      at: r.created_at as string,
      text: `${fmtDay(r.created_at as string)} · корректировка ${delta > 0 ? "+" : ""}${delta} мин — ${r.comment} (${author})`,
    });
  }
  for (const items of historyBySub.values()) {
    items.sort((a, b) => b.at.localeCompare(a.at));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Абонементы</h1>
      <p className="mt-1 text-sm text-muted">
        Пока нет отметки оплаты, абонемент — «ожидает»: он не входит в выручку
        и комиссию продавца. Минуты правятся только с комментарием — всё в логе.
      </p>

      <details className="mt-4 rounded-2xl border border-line bg-surface">
        <summary className="cursor-pointer list-none p-4 font-semibold text-primary [&::-webkit-details-marker]:hidden">
          + Продать абонемент
        </summary>
        <div className="border-t border-line/70 p-4 pt-3">
          <SellSubscriptionForm
            clients={clientsRes.data ?? []}
            staff={staffRes.data ?? []}
            today={today}
          />
        </div>
      </details>

      <div className="mt-4 flex gap-1.5">
        {[
          { key: "", label: "Активные" },
          { key: "all", label: "Все" },
        ].map((tab) => (
          <Link
            key={tab.key}
            href={tab.key ? `/admin/subscriptions?f=${tab.key}` : "/admin/subscriptions"}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              f === tab.key
                ? "bg-primary text-white"
                : "border border-line text-muted hover:border-primary hover:text-primary"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {subs.length === 0 && (
        <p className="mt-6 text-sm text-muted">Абонементов пока нет.</p>
      )}
      <div className="mt-4 space-y-3">
        {subs.map((s) => (
          <SubscriptionCard
            key={s.id}
            s={s}
            left={s.total_minutes + (adjBySub.get(s.id) ?? 0) - (usedBySub.get(s.id) ?? 0)}
            history={historyBySub.get(s.id) ?? []}
            today={today}
          />
        ))}
      </div>
    </div>
  );
}
