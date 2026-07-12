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

  await sendTelegram(chatId, lines.join("\n"));
}

// Уведомление в группу ИНСТРУКТОРОВ: админ подтвердил заявку → появилась
// запись, которую можно принять на сайте. Телефон клиента намеренно не шлём
// в общий чат — его увидит тот, кто примет запись в кабинете.
export async function sendInstructorsBookingAlert(b: {
  bookingNo: number | null;
  serviceName: string | null;
  scheduledTime: string | null;
  preferredDate: string | null;
}): Promise<void> {
  const chatId = process.env.TELEGRAM_INSTRUCTORS_CHAT_ID;
  if (!chatId) return; // группа ещё не подключена — тихо выходим

  const lines = [
    `🟢 Новая запись${b.bookingNo ? ` #${b.bookingNo}` : ""}`,
    "",
  ];
  if (b.serviceName) lines.push(`📋 ${b.serviceName}`);
  if (b.preferredDate) lines.push(`📅 ${b.preferredDate}`);
  if (b.scheduledTime) lines.push(`🕐 ${b.scheduledTime}`);
  lines.push("", "Принять: https://fly-guru.vercel.app/instructor/bookings");

  await sendTelegram(chatId, lines.join("\n"));
}

// Общая отправка простым текстом (без Markdown — надёжнее, ничего не надо
// экранировать). Ошибки глотаем: уведомление — дополнение, не звено процесса.
async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      // Не ждём вечно: если Telegram недоступен, не держим ответ.
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Telegram недоступен/таймаут — не роняем операцию из-за уведомления.
  }
}
