import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { vnToday } from "@/lib/dates";
import { getMonthCalendar, initials } from "@/lib/shifts";
import { MonthGrid } from "@/components/cabinet/MonthGrid";
import { CalMonthNav, resolveCalYm } from "@/components/cabinet/CalMonthNav";
import { assignShiftAction, removeShiftAction } from "../actions";

export const metadata: Metadata = { title: "Админка · Календарь" };

// Календарь (пак H1): админ ставит инструкторам смены (выходы) на дни и видит
// записи клиентов по дням. Клик по дню открывает панель дня (?d=…) — чистый SSR.
// В паке H2 число смен за месяц пойдёт в ЗП (200 000 ₫ × выходов).

function fmtFullDay(d: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${d}T00:00:00Z`));
}

export default async function AdminCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; d?: string }>;
}) {
  const { m, d } = await searchParams;
  const ym = resolveCalYm(m);
  const today = vnToday();

  const supabase = await createClient();
  const cal = await getMonthCalendar(supabase, ym);

  // Выбранный день — только если он валиден и относится к открытому месяцу.
  const selected =
    d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d.startsWith(ym) ? d : undefined;
  const dayData = selected ? cal.days.get(selected) : undefined;
  // Смена инструктора на выбранный день (если есть) — для отметки и заметки.
  const shiftByInstr = new Map(
    (dayData?.shifts ?? []).map((s) => [s.instructorId, s]),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Календарь</h1>
      <p className="mt-1 text-sm text-muted">
        Ставьте инструкторам смены и смотрите записи по дням. Тап по дню — детали.
      </p>

      <CalMonthNav ym={ym} basePath="/admin/calendar" />

      <div className="mt-3">
        <MonthGrid
          ym={ym}
          today={today}
          selected={selected}
          hrefFor={(date) => `/admin/calendar?m=${ym}&d=${date}`}
          renderCell={(date) => {
            const entry = cal.days.get(date);
            if (!entry) return null;
            return (
              <>
                {entry.shifts.length > 0 && (
                  <div className="flex flex-wrap gap-0.5">
                    {entry.shifts.map((s) => (
                      <span
                        key={s.id}
                        title={s.name}
                        className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-accent/15 px-1 text-[10px] font-bold text-accent-strong"
                      >
                        {initials(s.name)}
                      </span>
                    ))}
                  </div>
                )}
                {entry.bookings.length > 0 && (
                  <span className="inline-block rounded bg-primary/10 px-1 text-[10px] font-semibold text-primary">
                    {entry.bookings.length} зап.
                  </span>
                )}
              </>
            );
          }}
        />
      </div>

      {/* Панель дня */}
      {selected && (
        <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-bold capitalize">{fmtFullDay(selected)}</h2>

          <h3 className="mt-3 text-sm font-bold text-muted">Смены</h3>
          <div className="mt-2 space-y-2">
            {cal.staff.map((u) => {
              const shift = shiftByInstr.get(u.id);
              return (
                <div
                  key={u.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-line/70 px-3 py-2"
                >
                  <span className="min-w-0 text-sm font-semibold">
                    {shift && <span className="text-accent-strong">🏄 </span>}
                    {u.name}
                    {shift?.note && (
                      <span className="font-normal text-muted"> · {shift.note}</span>
                    )}
                  </span>
                  {shift ? (
                    <form action={removeShiftAction} className="shrink-0">
                      <input type="hidden" name="instructorId" value={u.id} />
                      <input type="hidden" name="date" value={selected} />
                      <button
                        type="submit"
                        className="text-xs font-semibold text-muted transition-colors hover:text-red-500"
                      >
                        Убрать
                      </button>
                    </form>
                  ) : (
                    <form action={assignShiftAction} className="flex shrink-0 items-center gap-1.5">
                      <input type="hidden" name="instructorId" value={u.id} />
                      <input type="hidden" name="date" value={selected} />
                      <input
                        type="text"
                        name="note"
                        placeholder="заметка"
                        className="w-24 rounded-lg border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-primary"
                      />
                      <button
                        type="submit"
                        className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-primary/90"
                      >
                        Смена
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
            {cal.staff.length === 0 && (
              <p className="text-sm text-muted">Инструкторов нет.</p>
            )}
          </div>

          <h3 className="mt-4 text-sm font-bold text-muted">Записи клиентов</h3>
          {dayData && dayData.bookings.length > 0 ? (
            <div className="mt-2 space-y-2">
              {dayData.bookings.map((b) => (
                <div key={b.id} className="text-sm">
                  <span className="font-semibold">{b.time ?? "—"}</span> ·{" "}
                  {b.clientName}
                  {b.serviceName && (
                    <span className="text-muted"> · {b.serviceName}</span>
                  )}
                  {b.acceptedName && (
                    <span className="text-muted"> · принял {b.acceptedName}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Записей на этот день нет.</p>
          )}
        </section>
      )}
    </div>
  );
}
