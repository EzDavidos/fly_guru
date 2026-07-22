import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { vnToday } from "@/lib/dates";
import {
  confirmBookingAction,
  saveBookingAction,
  togglePinAction,
  setStatusAction,
  rescheduleAction,
} from "../actions";
import { MANUAL_CHANNELS } from "@/lib/channels";
import { SaveForm } from "../SaveForm";
import { getActiveDict } from "@/lib/dictionaries";
import { BookingCreateForm } from "./BookingCreateForm";

export const metadata: Metadata = { title: "Админка · Заявки" };

// Лента «Актуальные заявки»: полный цикл new → contacted → confirmed →
// done/cancelled/archived. «Ожидает оплату» — не отдельный статус, а
// подтверждённая запись, которую уже принял инструктор (accepted_by).
// «Перенесена» — бейдж по rescheduled_at, статус при этом живёт дальше.

interface BookingRow {
  id: string;
  booking_no: number | null;
  client_name: string;
  phone: string;
  telegram_username: string | null;
  preferred_date: string | null;
  scheduled_time: string | null;
  age: number | null;
  weight: number | null;
  status: string;
  pinned: boolean;
  ref_code: string | null;
  src: string | null;
  utm: Record<string, string> | null;
  internal_note: string | null;
  client_id: string | null;
  rescheduled_at: string | null;
  created_at: string;
  services: { name: string; category: string } | null;
  accepted: { name: string } | null;
}

const TERMINAL = ["done", "cancelled", "archived"];

// Подпись и цвет бейджа. «Ожидает оплату» вычисляем из accepted.
function statusBadge(b: BookingRow): { label: string; cls: string } {
  if (b.status === "confirmed" && b.accepted)
    return { label: "Ожидает оплату", cls: "bg-purple-500/10 text-purple-600" };
  const map: Record<string, { label: string; cls: string }> = {
    new: { label: "Новая", cls: "bg-red-500/10 text-red-600" },
    contacted: { label: "В обработке", cls: "bg-amber-500/10 text-amber-600" },
    confirmed: { label: "Подтверждена", cls: "bg-primary/10 text-primary" },
    done: { label: "Выполнена", cls: "bg-emerald-500/10 text-emerald-600" },
    cancelled: { label: "Отменена", cls: "bg-line text-muted" },
    archived: { label: "Архив", cls: "bg-line text-muted" },
  };
  return map[b.status] ?? { label: b.status, cls: "bg-line text-muted" };
}

// Приоритет в ленте: закреплённые → новые → в обработке → подтверждённые →
// ожидающие оплату; выполненные/отменённые всегда внизу.
function rank(b: BookingRow): number {
  if (TERMINAL.includes(b.status)) return 100;
  if (b.pinned) return 0;
  if (b.status === "new") return 1;
  if (b.status === "contacted") return 2;
  if (b.status === "confirmed" && !b.accepted) return 3;
  return 4;
}

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary";
const btnGhost =
  "rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary";
const btnAccent =
  "rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-strong";

// Карточка заявки: свёрнута — одна строка, тап раскрывает детали и действия.
function BookingCard({
  b,
  today,
  hasPendingReward,
}: {
  b: BookingRow;
  today: string;
  hasPendingReward: boolean;
}) {
  const badge = statusBadge(b);
  const terminal = TERMINAL.includes(b.status);
  const utmEntries = Object.entries(b.utm ?? {});

  return (
    <details
      className={`group rounded-2xl border bg-surface ${
        b.pinned && !terminal
          ? "border-red-400 shadow-[0_0_14px_rgba(248,113,113,0.35)]"
          : "border-line"
      }`}
    >
      {/* Свёрнутая строка */}
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <p className={`truncate font-bold ${terminal ? "text-muted" : ""}`}>
            {b.pinned && !terminal && <span title="Закреплена">📌 </span>}
            {b.booking_no != null && (
              <span className="text-muted">#{b.booking_no} </span>
            )}
            {b.client_name}
          </p>
          <p className="truncate text-xs text-muted">
            {[
              b.services?.name,
              b.preferred_date === today ? "Сегодня" : b.preferred_date,
              b.scheduled_time,
            ]
              .filter(Boolean)
              .join(" · ") || "Детали не заполнены"}
          </p>
        </div>
        {b.rescheduled_at && !terminal && (
          <span className="rounded-full bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-600">
            Перенесена
          </span>
        )}
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>
          {badge.label}
        </span>
        <span className="text-muted transition-transform group-open:rotate-180">▾</span>
      </summary>

      {/* Раскрытая карточка */}
      <div className="border-t border-line/70 p-4 pt-3">
        <div className="space-y-0.5 text-sm">
          <a href={`tel:${b.phone}`} className="text-primary underline">
            {b.phone}
          </a>
          {/* Ник в телеге приходит с сайта (0018) — второй способ достучаться,
              когда номер не отвечает. */}
          {b.telegram_username && (
            <a
              href={`https://t.me/${b.telegram_username}`}
              target="_blank"
              rel="noreferrer"
              className="block text-primary underline"
            >
              @{b.telegram_username}
            </a>
          )}
          {b.accepted && (
            <p className="text-muted">
              Принял: <span className="text-primary">{b.accepted.name}</span>
            </p>
          )}
        </div>

        {/* Атрибуция: откуда пришёл клиент */}
        {(b.src || b.ref_code || utmEntries.length > 0) && (
          <div className="mt-2 space-y-0.5 rounded-xl bg-line/30 px-3 py-2 text-xs text-muted">
            {b.src && <p>Источник: {MANUAL_CHANNELS[b.src] ?? b.src}</p>}
            {b.ref_code && <p>Реф-код: {b.ref_code} (скидка 200 000 ₫ на базовое)</p>}
            {utmEntries.map(([k, v]) => (
              <p key={k}>
                {k}: {v}
              </p>
            ))}
          </div>
        )}

        {/* Поля созвона + основные действия. Кнопки статусов ниже идут через
            свой formAction — мимо SaveForm: у них обратная связь своя, меняется
            бейдж карточки. SaveForm подтверждает именно «Сохранить». */}
        <SaveForm
          action={b.status === "new" ? confirmBookingAction : saveBookingAction}
          className="mt-3"
        >
          <input type="hidden" name="id" value={b.id} />
          <input type="hidden" name="pinned" value={b.pinned ? "1" : "0"} />

          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs text-muted">
              Время прихода
              <input
                type="text"
                name="scheduledTime"
                defaultValue={b.scheduled_time ?? ""}
                placeholder="10:30"
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs text-muted">
              Возраст
              <input
                type="number"
                name="age"
                defaultValue={b.age ?? ""}
                min={1}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs text-muted">
              Вес, кг
              <input
                type="number"
                name="weight"
                defaultValue={b.weight ?? ""}
                min={1}
                className={`mt-1 ${inputClass}`}
              />
            </label>
          </div>
          <label className="mt-2 block text-xs text-muted">
            Заметка (пожелания клиента, договорённости — видна инструкторам)
            <textarea
              name="note"
              rows={2}
              defaultValue={b.internal_note ?? ""}
              className={`mt-1 ${inputClass}`}
            />
          </label>

          <div className="mt-3 flex flex-wrap gap-2">
            {(b.status === "new" || b.status === "contacted") && (
              <button type="submit" formAction={confirmBookingAction} className={btnAccent}>
                Подтвердить → в записи
              </button>
            )}
            {b.status === "new" && (
              <button
                formAction={setStatusAction.bind(null, "contacted")}
                className={btnGhost}
              >
                В обработку
              </button>
            )}
            {!terminal && b.status !== "new" && (
              <button type="submit" className={btnGhost}>
                Сохранить
              </button>
            )}
            {b.status === "confirmed" && (
              <>
                <button
                  formAction={setStatusAction.bind(null, "done")}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  Выполнена
                </button>
                <button formAction={togglePinAction} className={btnGhost}>
                  {b.pinned ? "Открепить" : "Закрепить"}
                </button>
              </>
            )}
            {!terminal && (
              // Провести заявку. Абонемент — не сессия: ведём на форму продажи
              // абонемента (там минуты/членство/оплата), иначе на «Запись
              // клиента». В обоих случаях сохранение закроет заявку (done).
              <Link
                href={
                  b.services?.category === "subscription"
                    ? `/admin/subscriptions?booking=${b.id}`
                    : `/admin/record?booking=${b.id}`
                }
                className={btnGhost}
              >
                {b.services?.category === "subscription" ? "Продать абонемент" : "Записать клиента"}
              </Link>
            )}
            {!terminal && (
              <button
                formAction={setStatusAction.bind(null, "cancelled")}
                className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-red-500 hover:text-red-500"
              >
                Отменить
              </button>
            )}
            {b.status === "done" && hasPendingReward && (
              <button
                formAction={setStatusAction.bind(null, "done")}
                className={btnAccent}
              >
                Подтвердить реф-награду
              </button>
            )}
            {(b.status === "done" || b.status === "cancelled") && (
              <button
                formAction={setStatusAction.bind(null, "archived")}
                className={btnGhost}
              >
                В архив
              </button>
            )}
          </div>
        </SaveForm>

        {/* Перенос: новая дата/время, статус остаётся живым */}
        {!terminal && (
          <form action={rescheduleAction} className="mt-3 flex items-end gap-2">
            <input type="hidden" name="id" value={b.id} />
            <label className="flex-1 text-xs text-muted">
              Перенести на
              <input type="date" name="newDate" required className={`mt-1 ${inputClass}`} />
            </label>
            <label className="w-24 text-xs text-muted">
              Время
              <input
                type="text"
                name="newTime"
                placeholder="10:30"
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <button type="submit" className={btnGhost}>
              Перенести
            </button>
          </form>
        )}
      </div>
    </details>
  );
}

// Чипсы-фильтры по статусу (обычные ссылки — страница серверная).
const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Все" },
  { key: "new", label: "Новые" },
  { key: "contacted", label: "В обработке" },
  { key: "confirmed", label: "Подтверждены" },
  { key: "awaiting", label: "Ждут оплату" },
  { key: "done", label: "Выполнены" },
  { key: "cancelled", label: "Отменены" },
  { key: "archived", label: "Архив" },
];

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: filter = "" } = await searchParams;
  const supabase = await createClient();
  const today = vnToday();
  const paymentMethods = await getActiveDict(supabase, "payment_methods");

  // Услуги для формы ручной заявки. Абонемент отсюда исключён намеренно: его
  // продают через /admin/subscriptions, иначе продажа пройдёт мимо минут
  // и membership (та же дыра, что чинили в 4.8).
  const { data: serviceRows } = await supabase
    .from("services")
    .select("id, name, category")
    .eq("active", true)
    .neq("category", "subscription")
    .order("name");
  const services = (serviceRows ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
  }));

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, booking_no, client_name, phone, telegram_username, preferred_date, scheduled_time, age, weight, status, pinned, ref_code, src, utm, internal_note, client_id, rescheduled_at, created_at, services(name, category), accepted:users!accepted_by(name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const all = (data ?? []) as unknown as BookingRow[];

  // Фильтр: «Все» скрывает архив, остальные чипсы показывают свой срез.
  let bookings = all;
  if (filter === "awaiting") {
    bookings = all.filter((b) => b.status === "confirmed" && b.accepted);
  } else if (filter === "confirmed") {
    bookings = all.filter((b) => b.status === "confirmed" && !b.accepted);
  } else if (filter) {
    bookings = all.filter((b) => b.status === filter);
  } else {
    bookings = all.filter((b) => b.status !== "archived");
  }

  // Сортировка: приоритет статуса, внутри активных — ближайшая дата,
  // внутри закрытых — свежие сверху (created_at уже desc из запроса).
  bookings = [...bookings].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    if (TERMINAL.includes(a.status)) return 0;
    return (a.preferred_date ?? "9999").localeCompare(b.preferred_date ?? "9999");
  });

  // У каких выполненных заявок ещё висит неподтверждённая награда агента.
  const doneClientIds = bookings
    .filter((b) => b.status === "done" && b.ref_code && b.client_id)
    .map((b) => b.client_id as string);
  let pendingRewardClients = new Set<string>();
  if (doneClientIds.length > 0) {
    const { data: rewards } = await supabase
      .from("referral_rewards")
      .select("client_id")
      .eq("status", "pending")
      .in("client_id", doneClientIds);
    pendingRewardClients = new Set((rewards ?? []).map((r) => r.client_id as string));
  }

  const freshCount = all.filter((b) => b.status === "new").length;

  return (
    <div>
      {/* Живое обновление ленты и бейджа — в layout кабинета (BookingsBadgeRefresh). */}
      <h1 className="text-2xl font-bold">
        Актуальные заявки
        {freshCount > 0 && (
          <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 align-middle text-xs font-bold text-white">
            {freshCount}
          </span>
        )}
      </h1>
      <p className="mt-1 text-sm text-muted">
        Тап по заявке раскрывает карточку. Созвонились → внесите время, возраст,
        вес → «Подтвердить»: запись увидят инструкторы. Позвонили или написали
        напрямую — заведите заявку сами кнопкой ниже.
      </p>

      <div className="mt-4">
        <BookingCreateForm
          services={services}
          today={today}
          paymentMethods={paymentMethods}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key ? `/admin/bookings?status=${f.key}` : "/admin/bookings"}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f.key
                ? "bg-primary text-white"
                : "border border-line text-muted hover:border-primary hover:text-primary"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {bookings.length === 0 && (
        <p className="mt-6 text-sm text-muted">Здесь пока пусто.</p>
      )}
      <div className="mt-4 space-y-3">
        {bookings.map((b) => (
          <BookingCard
            key={b.id}
            b={b}
            today={today}
            hasPendingReward={!!b.client_id && pendingRewardClients.has(b.client_id)}
          />
        ))}
      </div>
    </div>
  );
}
