import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { vnToday } from "@/lib/dates";
import { getMonthCalendar } from "@/lib/shifts";
import { MonthGrid } from "@/components/cabinet/MonthGrid";
import { CalMonthNav, resolveCalYm } from "@/components/cabinet/CalMonthNav";

// Календарь инструктора (пак H1) — read-only. Свои смены подсвечены, видно и
// команду (кто когда работает), и записи клиентов по дням. Смены ставит админ.

function fmtFullDay(d: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${d}T00:00:00Z`));
}

export default async function InstructorCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; d?: string }>;
}) {
  const { m, d } = await searchParams;
  const ym = resolveCalYm(m);
  const today = vnToday();

  const user = await getAppUser();
  if (!user) return null; // layout уже средиректил бы; страховка для типов

  const supabase = await createClient();
  const cal = await getMonthCalendar(supabase, ym);

  const selected =
    d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d.startsWith(ym) ? d : undefined;
  const dayData = selected ? cal.days.get(selected) : undefined;

  return (
    <div>
      <h1 className="text-2xl font-bold">Календарь</h1>
      <p className="mt-1 text-sm text-muted">
        Ваши смены подсвечены. Видно команду и записи клиентов по дням. Смены
        ставит админ.
      </p>

      <CalMonthNav ym={ym} basePath="/instructor/calendar" />

      <div className="mt-3">
        <MonthGrid
          ym={ym}
          today={today}
          selected={selected}
          hrefFor={(date) => `/instructor/calendar?m=${ym}&d=${date}`}
          renderCell={(date) => {
            const entry = cal.days.get(date);
            if (!entry) return null;
            return (
              <>
                {entry.shifts.length > 0 && (
                  <div className="space-y-0.5">
                    {entry.shifts.map((s) => {
                      const mine = s.instructorId === user.id;
                      return (
                        <span
                          key={s.id}
                          title={s.name}
                          className={`block truncate rounded px-1 text-[10px] font-bold ${
                            mine
                              ? "bg-primary text-white"
                              : "bg-accent/15 text-accent-strong"
                          }`}
                        >
                          {s.name}
                        </span>
                      );
                    })}
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

      {/* Панель дня (read-only) */}
      {selected && (
        <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <h2 className="font-bold capitalize">{fmtFullDay(selected)}</h2>

          <h3 className="mt-3 text-sm font-bold text-muted">На смене</h3>
          {dayData && dayData.shifts.length > 0 ? (
            <div className="mt-2 space-y-1">
              {dayData.shifts.map((s) => (
                <p key={s.id} className="text-sm">
                  {s.instructorId === user.id && (
                    <span className="text-primary">🏄 </span>
                  )}
                  <span className="font-semibold">{s.name}</span>
                  {s.instructorId === user.id && (
                    <span className="text-muted"> · вы</span>
                  )}
                  {s.note && <span className="text-muted"> · {s.note}</span>}
                </p>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Смен на этот день нет.</p>
          )}

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
