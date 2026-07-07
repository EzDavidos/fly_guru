// Простая защита от «слишком частых» отправок формы с одного адреса.
//
// Простыми словами: считаем, сколько раз за последнюю минуту с одного IP пришла
// заявка. Если больше лимита — просим подождать. Это отсекает грубый спам.
//
// Оговорка честно: счётчик живёт в памяти одного серверного процесса. На Vercel
// процессов бывает несколько, и между ними память не общая — поэтому это
// «мягкий» барьер, а не строгая гарантия. Для маленького сайта в связке с
// honeypot этого достаточно. Строгий лимит потребовал бы внешнего хранилища
// (например Upstash/Redis) — вернёмся к этому, если появится реальный спам.

interface Bucket {
  count: number;
  resetAt: number; // время (мс), когда счётчик обнулится
}

const WINDOW_MS = 60_000; // окно 1 минута
const MAX_REQUESTS = 5; // не больше 5 заявок с одного IP в минуту

const buckets = new Map<string, Bucket>();

// Возвращает true, если запрос разрешён; false — если лимит превышен.
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(ip);

  if (!bucket || now > bucket.resetAt) {
    // Нет записи или окно истекло — начинаем новое окно.
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (bucket.count >= MAX_REQUESTS) {
    return false; // лимит на эту минуту исчерпан
  }

  bucket.count += 1;
  return true;
}
