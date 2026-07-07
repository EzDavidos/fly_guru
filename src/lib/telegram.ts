// Уведомление о новой заявке в Telegram.
//
// Простыми словами: у Telegram есть «робот» (бот), которому можно через интернет
// послать команду «отправь сообщение в такой-то чат». Мы создаём бота через
// @BotFather, кладём его секретный токен и id чата в переменные окружения, и при
// каждой новой заявке шлём тебе короткое сообщение.
//
// Если токен/чат не настроены — функция молча ничего не делает. Заявка при этом
// всё равно сохраняется в базу. Уведомление — дополнение, не обязательное звено.

interface BookingNotification {
  serviceName: string | null; // название услуги
  clientName: string;
  contact: string; // телефон/мессенджер как ввёл гость
  messenger?: string | null; // WhatsApp/Telegram/Zalo
  preferredDate?: string | null;
  refCode?: string | null;
  src?: string | null; // источник (instagram, qr…)
  comment?: string | null;
}

export async function sendBookingNotification(
  b: BookingNotification,
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Не настроено — тихо выходим. Это нормальный режим до подключения бота.
  if (!token || !chatId) return;

  // Собираем текст сообщения построчно. Пустые (необязательные) поля пропускаем.
  // Шлём простым текстом (без Markdown) — так надёжнее: не нужно экранировать
  // спецсимволы, любые данные клиента отправятся без риска ошибки форматирования.
  const lines: string[] = ["🔔 Новая заявка FlyGuru", ""];
  if (b.serviceName) lines.push(`📋 Услуга: ${b.serviceName}`);
  lines.push(`👤 Имя: ${b.clientName}`);
  const contactLine = b.messenger
    ? `${b.contact} (${b.messenger})`
    : b.contact;
  lines.push(`📞 Контакт: ${contactLine}`);
  if (b.preferredDate) lines.push(`📅 Дата: ${b.preferredDate}`);
  if (b.comment) lines.push(`💬 Комментарий: ${b.comment}`);
  if (b.refCode) lines.push(`🎟️ Реф-код: ${b.refCode}`);
  if (b.src) lines.push(`🧭 Источник: ${b.src}`);

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join("\n"),
      }),
      // Не ждём вечно: если Telegram недоступен, не держим ответ заявки.
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Telegram недоступен/таймаут — не роняем заявку из-за уведомления.
  }
}
