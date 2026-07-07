import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";
import { sendBookingNotification } from "@/lib/telegram";

// «Серверная дверь» для заявок с форм. Форма шлёт сюда данные, а здесь мы их
// проверяем, защищаем от спама и сохраняем в таблицу bookings.

// Форма присылает вот такой набор полей.
interface BookingPayload {
  clientName?: string;
  contact?: string; // телефон/ник в мессенджере, как ввёл гость
  messenger?: string; // WhatsApp / Telegram / Zalo
  serviceId?: string; // uuid услуги из таблицы services
  preferredDate?: string; // желаемая дата 'YYYY-MM-DD'
  comment?: string;
  honeypot?: string; // поле-ловушка: у живого человека всегда пустое
  // Метки источника, собранные на клиенте (см. lib/attribution.ts):
  ref_code?: string | null;
  src?: string | null;
  utm?: Record<string, string>;
}

// Простая проверка, что строка похожа на uuid (id услуги). Если нет — не рискуем
// нарушить связь с таблицей услуг и просто не проставляем услугу.
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function POST(req: NextRequest) {
  let body: BookingPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  // 1. Honeypot. Если ловушка заполнена — это бот. Отвечаем «успех», но НЕ пишем
  //    в базу: пусть бот думает, что всё получилось, и не пробует снова.
  if (body.honeypot && body.honeypot.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  // 2. Ограничение частоты по IP-адресу.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  // 3. Минимальная проверка: без имени и контакта заявка бессмысленна.
  const clientName = body.clientName?.trim();
  const contact = body.contact?.trim();
  if (!clientName || !contact) {
    return NextResponse.json(
      { ok: false, error: "missing_fields" },
      { status: 400 },
    );
  }

  const serviceId = body.serviceId && isUuid(body.serviceId) ? body.serviceId : null;
  const messenger = body.messenger?.trim() || null;
  const comment = body.comment?.trim() || null;
  const preferredDate = body.preferredDate?.trim() || null;
  const refCode = body.ref_code?.trim() || null;
  const src = body.src?.trim() || null;
  const utm = body.utm && typeof body.utm === "object" ? body.utm : {};

  // Предпочтительный канал связи храним в internal_note (заметка для менеджера) —
  // отдельной колонки под мессенджер в схеме нет, а знать канал полезно.
  const internalNote = messenger ? `Предпочтительная связь: ${messenger}` : null;

  const supabase = createAdminClient();

  // 4. Запись заявки. status по умолчанию 'new' (задан в схеме).
  const { error } = await supabase.from("bookings").insert({
    client_name: clientName,
    phone: contact,
    service_id: serviceId,
    preferred_date: preferredDate,
    ref_code: refCode,
    src,
    utm,
    internal_note: internalNote,
  });

  if (error) {
    console.error("[bookings] insert error:", error.message);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }

  // 5. Уведомление в Telegram. Для красивого текста подтянем название услуги.
  let serviceName: string | null = null;
  if (serviceId) {
    const { data } = await supabase
      .from("services")
      .select("name")
      .eq("id", serviceId)
      .maybeSingle();
    serviceName = data?.name ?? null;
  }

  await sendBookingNotification({
    serviceName,
    clientName,
    contact,
    messenger,
    preferredDate,
    refCode,
    src,
    comment,
  });

  return NextResponse.json({ ok: true });
}
