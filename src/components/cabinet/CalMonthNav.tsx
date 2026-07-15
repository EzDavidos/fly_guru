import { Link } from "@/i18n/navigation";
import { vnCurrentMonth, vnMonth } from "@/lib/dates";

// Переключатель месяцев для КАЛЕНДАРЯ (пак H1). В отличие от MonthSwitcher
// (расчёт/статистика — только прошлое) пускает и в будущее: смены планируют
// наперёд. Переход на другой месяц сбрасывает выбранный день (?d).

function shiftYm(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}

// Валидный 'YYYY-MM' из ?m= (любой месяц); мусор/пусто → текущий.
export function resolveCalYm(m: string | undefined): string {
  return /^\d{4}-\d{2}$/.test(m ?? "") ? m! : vnCurrentMonth().fromDay.slice(0, 7);
}

export function CalMonthNav({ ym, basePath }: { ym: string; basePath: string }) {
  const currentYm = vnCurrentMonth().fromDay.slice(0, 7);
  return (
    <div className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-surface px-2 py-1.5">
      <Link
        href={`${basePath}?m=${shiftYm(ym, -1)}`}
        className="rounded-full px-3 py-1.5 text-lg text-muted transition-colors hover:text-primary"
        aria-label="Предыдущий месяц"
      >
        ‹
      </Link>
      <span className="flex items-center gap-2 font-semibold capitalize">
        {vnMonth(ym).label}
        {ym !== currentYm && (
          <Link
            href={basePath}
            className="rounded-full px-2 py-0.5 text-xs font-semibold text-primary hover:underline"
          >
            сегодня
          </Link>
        )}
      </span>
      <Link
        href={`${basePath}?m=${shiftYm(ym, 1)}`}
        className="rounded-full px-3 py-1.5 text-lg text-muted transition-colors hover:text-primary"
        aria-label="Следующий месяц"
      >
        ›
      </Link>
    </div>
  );
}
