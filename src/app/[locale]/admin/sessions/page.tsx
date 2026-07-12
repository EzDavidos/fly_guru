import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { vnCurrentMonth, vnPeriod, vnToday } from "@/lib/dates";
import { vnd } from "@/lib/stats";
import { updateSessionAction } from "../actions";
import { SessionCreateForm } from "./SessionCreateForm";

export const metadata: Metadata = { title: "Админка · Сессии" };

// Сессии школы: список за период + создание задним числом + правка.
// Сессия — факт занятия с чеком; списания минут абонемента тоже сессии
// (amount = 0), их минуты правятся только корректировками (подэтап 4.3).

interface SessionRow {
  id: string;
  date: string;
  amount: number;
  minutes_used: number | null;
  subscription_id: string | null;
  service_id: string | null;
  instructor_id: string | null;
  clients: { name: string } | null;
  services: { name: string } | null;
  instructor: { name: string } | null;
}

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function SessionCard({
  s,
  services,
  staff,
}: {
  s: SessionRow;
  services: { id: string; name: string }[];
  staff: { id: string; name: string }[];
}) {
  const isWriteoff = s.subscription_id !== null;

  return (
    <details className="group rounded-2xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{s.clients?.name ?? "Без клиента"}</p>
          <p className="truncate text-xs text-muted">
            {[
              s.date,
              isWriteoff
                ? `списание ${s.minutes_used ?? 0} мин`
                : s.services?.name,
              s.instructor?.name,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <span
          className={`text-sm font-bold ${isWriteoff ? "text-muted" : "text-primary"}`}
        >
          {isWriteoff ? "абонемент" : vnd(s.amount)}
        </span>
        <span className="text-muted transition-transform group-open:rotate-180">▾</span>
      </summary>

      <form action={updateSessionAction} className="border-t border-line/70 p-4 pt-3">
        <input type="hidden" name="id" value={s.id} />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted">
            Дата
            <input
              type="date"
              name="date"
              defaultValue={s.date}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="text-xs text-muted">
            Инструктор
            <select
              name="instructorId"
              defaultValue={s.instructor_id ?? ""}
              className={`mt-1 ${inputClass}`}
            >
              <option value="">—</option>
              {staff.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          {!isWriteoff && (
            <>
              <label className="text-xs text-muted">
                Услуга
                <select
                  name="serviceId"
                  defaultValue={s.service_id ?? ""}
                  className={`mt-1 ${inputClass}`}
                >
                  <option value="">—</option>
                  {services.map((sv) => (
                    <option key={sv.id} value={sv.id}>
                      {sv.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                Сумма чека, ₫
                <input
                  type="text"
                  name="amount"
                  inputMode="numeric"
                  defaultValue={s.amount}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
            </>
          )}
        </div>
        {isWriteoff && (
          <p className="mt-2 text-xs text-muted">
            Списание {s.minutes_used ?? 0} мин с абонемента. Минуты правятся
            корректировкой абонемента (с комментарием), не здесь.
          </p>
        )}
        <button
          type="submit"
          className="mt-3 rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
        >
          Сохранить
        </button>
      </form>
    </details>
  );
}

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const month = vnCurrentMonth();
  const today = vnToday();

  // Период: обе даты включительно; по умолчанию — текущий месяц.
  const fromDay = DAY_RE.test(params.from ?? "") ? params.from! : month.fromDay;
  const toInclusive = DAY_RE.test(params.to ?? "")
    ? params.to!
    : new Date(new Date(month.toDay).getTime() - 86400000).toISOString().slice(0, 10);
  const range = vnPeriod(fromDay, toInclusive);

  const supabase = await createClient();
  const [sessionsRes, clientsRes, servicesRes, staffRes] = await Promise.all([
    supabase
      .from("sessions")
      .select(
        "id, date, amount, minutes_used, subscription_id, service_id, instructor_id, clients(name), services(name), instructor:users!instructor_id(name)",
      )
      .gte("date", range.fromDay)
      .lt("date", range.toDay)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("clients").select("id, name, phone").order("name").limit(1000),
    // Без категории subscription: абонемент — не сессия, у него своя форма
    // с минутами, членством и тумблером оплаты (/admin/subscriptions).
    supabase
      .from("services")
      .select("id, name, price")
      .eq("active", true)
      .neq("category", "subscription")
      .order("name"),
    supabase.from("users").select("id, name").in("role", ["instructor", "admin"]).order("name"),
  ]);

  const sessions = (sessionsRes.data ?? []) as unknown as SessionRow[];
  const clients = clientsRes.data ?? [];
  const services = (servicesRes.data ?? []).map((s) => ({
    ...s,
    price: Number(s.price ?? 0),
  }));
  const staff = staffRes.data ?? [];

  const total = sessions.reduce((sum, s) => sum + (s.amount ?? 0), 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">Сессии</h1>
      <p className="mt-1 text-sm text-muted">
        Все занятия школы. Инструктор забыл оформить — создайте сессию задним
        числом, она войдёт в выручку и его ЗП за месяц её даты.
      </p>

      {/* Создание — свёрнуто, чтобы не мешать просмотру */}
      <details className="mt-4 rounded-2xl border border-line bg-surface">
        <summary className="cursor-pointer list-none p-4 font-semibold text-primary [&::-webkit-details-marker]:hidden">
          + Создать сессию
        </summary>
        <div className="border-t border-line/70 p-4 pt-3">
          <SessionCreateForm
            clients={clients}
            services={services}
            staff={staff}
            today={today}
          />
        </div>
      </details>

      {/* Фильтр по периоду (GET — страница серверная) */}
      <form className="mt-4 flex items-end gap-2">
        <label className="flex-1 text-xs text-muted">
          С
          <input
            type="date"
            name="from"
            defaultValue={fromDay}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="flex-1 text-xs text-muted">
          По
          <input
            type="date"
            name="to"
            defaultValue={toInclusive}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <button
          type="submit"
          className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
        >
          Показать
        </button>
      </form>

      <p className="mt-4 text-sm text-muted">
        {sessions.length} сессий ·{" "}
        <span className="font-bold text-ink">{vnd(total)}</span>
      </p>

      {sessions.length === 0 && (
        <p className="mt-4 text-sm text-muted">За этот период сессий нет.</p>
      )}
      <div className="mt-3 space-y-3">
        {sessions.map((s) => (
          <SessionCard key={s.id} s={s} services={services} staff={staff} />
        ))}
      </div>
    </div>
  );
}
