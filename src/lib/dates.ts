// Даты в часовом поясе школы (Нячанг, UTC+7, без переходов на летнее время).
// Сервер (Vercel) живёт в UTC, поэтому «сегодня» и «текущий месяц» считаем явно.

const VN_OFFSET_MS = 7 * 3600 * 1000;

// Текущий момент, сдвинутый в местное время Вьетнама.
function vnNow(): Date {
  return new Date(Date.now() + VN_OFFSET_MS);
}

// Сегодняшняя дата в Нячанге: 'YYYY-MM-DD' (для колонок типа date).
export function vnToday(): string {
  return vnNow().toISOString().slice(0, 10);
}

// Границы текущего месяца в Нячанге.
// Для колонок date — строки 'YYYY-MM-DD'; для timestamptz — ISO-строки
// момента местной полуночи 1-го числа (в UTC это минус 7 часов).
export function vnCurrentMonth() {
  const now = vnNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based

  const fromDate = new Date(Date.UTC(y, m, 1));
  const toDate = new Date(Date.UTC(y, m + 1, 1));

  return {
    // Для сравнения с date-колонками: date >= from AND date < to
    fromDay: fromDate.toISOString().slice(0, 10),
    toDay: toDate.toISOString().slice(0, 10),
    // Для сравнения с timestamptz (paid_at): местная полночь в UTC
    fromIso: new Date(fromDate.getTime() - VN_OFFSET_MS).toISOString(),
    toIso: new Date(toDate.getTime() - VN_OFFSET_MS).toISOString(),
    // Человекочитаемая метка «июль 2026»
    label: new Intl.DateTimeFormat("ru-RU", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date()),
  };
}

// Произвольный период для статистики: обе даты включительно ('YYYY-MM-DD').
// Возвращает те же границы, что и vnCurrentMonth: правая — эксклюзивная
// (date >= fromDay AND date < toDay), ISO — местная полночь в UTC.
export function vnPeriod(fromDay: string, toDayInclusive: string) {
  const from = new Date(`${fromDay}T00:00:00Z`);
  const to = new Date(`${toDayInclusive}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + 1); // включительно → эксклюзивная граница

  return {
    fromDay,
    toDay: to.toISOString().slice(0, 10),
    fromIso: new Date(from.getTime() - VN_OFFSET_MS).toISOString(),
    toIso: new Date(to.getTime() - VN_OFFSET_MS).toISOString(),
  };
}

// Сдвиг даты 'YYYY-MM-DD' на n дней (для пресетов «последние 7 дней» и т.п.).
export function vnShiftDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Границы прошлого месяца в Нячанге (пресет статистики): первая и последняя
// даты месяца, обе включительно — в формате инпутов формы.
export function vnPrevMonth() {
  const now = vnNow();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return {
    fromDay: from.toISOString().slice(0, 10),
    lastDay: vnShiftDays(to.toISOString().slice(0, 10), -1),
  };
}

// Дата продажи + 3 месяца — срок жизни минут абонемента (архитектура, раздел 2).
export function subscriptionExpiry(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setUTCMonth(d.getUTCMonth() + 3);
  return d;
}
