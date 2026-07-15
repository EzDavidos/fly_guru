import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";

// Месячная сетка календаря (пак H1) — общая для кабинетов админа и инструктора.
// Презентационный server-компонент: раскладку месяца (понедельник-первый)
// считает сам, а содержимое ячейки и ссылку дня получает от страницы —
// у админа день кликабелен (панель дня), у инструктора может быть read-only.

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function MonthGrid({
  ym,
  today,
  selected,
  renderCell,
  hrefFor,
}: {
  ym: string; // 'YYYY-MM'
  today: string; // 'YYYY-MM-DD' — подсветка сегодня
  selected?: string; // выбранный день (панель дня открыта)
  renderCell: (dateStr: string) => ReactNode; // контент дня
  hrefFor?: (dateStr: string) => string | undefined; // ссылка дня (undefined = не кликаем)
}) {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Пн=0 … Вс=6
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  // Ячейки: пустые «хвосты» до 1-го числа + дни месяца.
  const cells: ({ dateStr: string; dayNum: number } | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ dateStr: `${ym}-${String(d).padStart(2, "0")}`, dayNum: d });
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-px text-center text-[11px] font-semibold text-muted">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-line">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`e${i}`} className="min-h-16 bg-surface/40" />;
          const isToday = cell.dateStr === today;
          const isSelected = cell.dateStr === selected;
          const href = hrefFor?.(cell.dateStr);

          const inner = (
            <>
              <div
                className={`text-xs font-bold ${
                  isToday
                    ? "inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white"
                    : "text-muted"
                }`}
              >
                {cell.dayNum}
              </div>
              <div className="mt-1 space-y-1">{renderCell(cell.dateStr)}</div>
            </>
          );

          const base = `min-h-16 p-1.5 text-left transition-colors sm:min-h-24 ${
            isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary" : "bg-surface"
          }`;

          return href ? (
            <Link key={cell.dateStr} href={href} className={`${base} block hover:bg-line/40`}>
              {inner}
            </Link>
          ) : (
            <div key={cell.dateStr} className={base}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
