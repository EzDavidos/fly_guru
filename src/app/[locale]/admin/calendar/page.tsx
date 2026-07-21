import type { Metadata } from "next";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { vnToday, vnTimeLabel } from "@/lib/dates";
import { getMonthCalendar, loadShiftPhotos, type ShiftPhoto } from "@/lib/shifts";
import {
  shiftStatus,
  OPEN_LABEL,
  CLOSE_LABEL,
  statusClass,
} from "@/lib/shiftRules";
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
  // Фото смен выбранного дня (пак C): подтягиваем только для открытого дня.
  const photosByShift: Map<string, ShiftPhoto[]> = selected
    ? await loadShiftPhotos(
        supabase,
        (dayData?.shifts ?? []).map((s) => s.id),
      )
    : new Map();

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
                  <div className="space-y-0.5">
                    {entry.shifts.map((s) => (
                      <span
                        key={s.id}
                        title={s.name}
                        className="block truncate rounded bg-accent/15 px-1 text-[10px] font-bold text-accent-strong"
                      >
                        {s.name}
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
              const status = shift
                ? shiftStatus(shift.openedAt, shift.closedAt)
                : null;
              const photos = shift
                ? (photosByShift.get(shift.id) ?? [])
                : [];
              return (
                <div
                  key={u.id}
                  className="rounded-xl border border-line/70 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 text-sm font-semibold">
                      {shift && <span className="text-accent-strong">🏄 </span>}
                      {u.name}
                      {shift && !shift.planned && (
                        <span className="font-normal text-muted"> · без плана</span>
                      )}
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

                  {/* Факт выхода: во сколько открыл/закрыл и статус */}
                  {status && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {shift!.openedAt ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(
                            status.open === "late",
                          )}`}
                        >
                          открыл {vnTimeLabel(shift!.openedAt)} · {OPEN_LABEL[status.open]}
                        </span>
                      ) : (
                        <span className="rounded-full bg-line/40 px-2 py-0.5 text-[11px] font-semibold text-muted">
                          не открыл
                        </span>
                      )}
                      {shift!.closedAt ? (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(
                            status.close === "early",
                          )}`}
                        >
                          закрыл {vnTimeLabel(shift!.closedAt)} · {CLOSE_LABEL[status.close]}
                        </span>
                      ) : shift!.openedAt ? (
                        <span className="rounded-full bg-line/40 px-2 py-0.5 text-[11px] font-semibold text-muted">
                          не закрыл
                        </span>
                      ) : null}
                    </div>
                  )}

                  {(shift?.openComment || shift?.closeComment) && (
                    <p className="mt-1 text-xs text-muted">
                      {shift.openComment && <>Открытие: {shift.openComment}. </>}
                      {shift.closeComment && <>Закрытие: {shift.closeComment}.</>}
                    </p>
                  )}

                  {/* Фото смены: открытие и закрытие */}
                  {photos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {photos.map((p) => (
                        <a
                          key={p.id}
                          href={p.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative block"
                          title={`${p.phase === "open" ? "Открытие" : "Закрытие"} · ${
                            p.equipmentName ?? p.kind
                          }`}
                        >
                          <Image
                            src={p.url}
                            alt={p.equipmentName ?? p.kind}
                            width={64}
                            height={64}
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                          <span className="absolute left-0 top-0 rounded-br-lg rounded-tl-lg bg-black/55 px-1 text-[9px] font-bold text-white">
                            {p.phase === "open" ? "утро" : "вечер"}
                          </span>
                        </a>
                      ))}
                    </div>
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
