"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { phoneDigits, phonesMatch } from "@/lib/phone";
import { subscriptionExpiry, vnToday } from "@/lib/dates";
import { minutesLeft } from "@/lib/subscriptions";
import { sendInstructorsBookingAlert } from "@/lib/telegram";
import { MANUAL_CHANNELS } from "@/lib/channels";
import type { ActionState } from "../instructor/actions";

// Server actions админки: полный цикл заявки. Админ созванивается с гостем,
// вносит время/возраст/вес и подтверждает — заявка становится «записью»,
// которую видят инструкторы. RLS-политика bookings_admin_all даёт полный доступ.

async function requireAdmin() {
  const user = await getAppUser();
  if (!user || user.role !== "admin") redirect("/login?next=/admin");
  return user;
}

// Числовое поле формы → integer или null (пустое/мусор не пишем в базу).
function intOrNull(value: FormDataEntryValue | null): number | null {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Общие поля карточки заявки из формы.
function bookingFields(formData: FormData) {
  return {
    scheduled_time: String(formData.get("scheduledTime") ?? "").trim() || null,
    age: intOrNull(formData.get("age")),
    weight: intOrNull(formData.get("weight")),
    internal_note: String(formData.get("note") ?? "").trim() || null,
  };
}

// Провалившаяся запись не должна выглядеть как успешная. Кидаем ошибку — её
// поймает admin/error.tsx и честно скажет «не сохранилось»; настоящая причина
// уходит в серверный лог. Раньше сбой видел только лог: страница
// перерисовывалась прежней, и человек продолжал заполнять CRM, думая, что всё
// записалось. Формы, которые умеют показывать текст ошибки под кнопкой
// (useActionState), сюда не ходят — они возвращают { error } как и раньше.
function failIfError(error: { message: string } | null, what: string): void {
  if (!error) return;
  console.error(`[admin] ${what}:`, error.message);
  throw new Error(`${what}: ${error.message}`);
}

// Обновить заявку и перерисовать всё, где висят счётчики (админка, кабинет,
// бейдж в шапке) — на масштабе школы дешевле, чем целиться в пути.
async function updateBooking(id: string, patch: Record<string, unknown>) {
  const supabase = await createClient();
  const { error } = await supabase.from("bookings").update(patch).eq("id", id);
  failIfError(error, "не удалось сохранить заявку");
  revalidatePath("/", "layout");
}

// Сообщение в группу инструкторов: «появилась новая запись, кто примет?»
// Телефон клиента в группу не шлём — только номер, услуга и время.
async function notifyInstructors(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bookings")
    .select("booking_no, scheduled_time, preferred_date, services(name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;
  const service = data.services as unknown as { name: string } | null;
  await sendInstructorsBookingAlert({
    bookingNo: data.booking_no,
    serviceName: service?.name ?? null,
    scheduledTime: data.scheduled_time,
    preferredDate: data.preferred_date,
  });
}

// Клиент пришёл по реф-коду и услуга проведена → награда агента из «ожидает»
// становится «подтверждена» (войдёт в расчёт месяца: клиенты × 300 000 ₫).
async function confirmPendingReward(id: string) {
  const supabase = await createClient();
  const { data: b } = await supabase
    .from("bookings")
    .select("client_id, ref_code")
    .eq("id", id)
    .maybeSingle();
  if (!b?.client_id || !b.ref_code) return;
  const { error } = await supabase
    .from("referral_rewards")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("client_id", b.client_id)
    .eq("status", "pending");
  // Кидаем до смены статуса заявки: либо награда подтверждена и заявка
  // «выполнена», либо не поменялось ничего — полумеры тут хуже ошибки.
  failIfError(error, "не удалось подтвердить награду агента");
}

// Ручная заявка: клиент позвонил / написал / пришёл ногами. Без неё такой
// клиент не попадал в CRM вообще — заявки умела создавать только форма сайта,
// а значит календарь и «Записи» инструктора не видели половину потока.
// По умолчанию сразу «Подтверждена»: админ уже договорился о дате голосом,
// второй шаг «Подтвердить» тут лишний. Тогда же уходит уведомление в телегу.
export async function createBookingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const clientName = String(formData.get("clientName") ?? "").trim();
  if (!clientName) return { error: "Укажите имя клиента." };
  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return { error: "Укажите телефон клиента." };

  const channel = String(formData.get("channel") ?? "").trim();
  if (!MANUAL_CHANNELS[channel]) return { error: "Выберите, откуда пришёл клиент." };

  const preferredDate = String(formData.get("preferredDate") ?? "").trim();
  if (preferredDate && !DAY_RE.test(preferredDate))
    return { error: "Дата — в формате ГГГГ-ММ-ДД." };

  const serviceId = String(formData.get("serviceId") ?? "");
  const confirmed = formData.get("status") !== "new";

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("bookings")
    .insert({
      client_name: clientName,
      phone,
      service_id: serviceId || null,
      preferred_date: preferredDate || null,
      status: confirmed ? "confirmed" : "new",
      src: channel,
      ...bookingFields(formData),
    })
    .select("id")
    .single();
  if (error) return { error: `Не удалось создать заявку: ${error.message}` };

  // Инструкторам сообщаем только о том, что уже подтверждено — как и с сайта.
  if (confirmed) await notifyInstructors(created.id as string).catch(() => {});

  revalidatePath("/", "layout");
  redirect("/admin/bookings");
}

// «Подтвердить»: сохранить данные созвона и опубликовать запись инструкторам.
export async function confirmBookingAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await updateBooking(id, { ...bookingFields(formData), status: "confirmed" });
  await notifyInstructors(id).catch(() => {});
}

// Смена статуса из карточки: в обработке / подтверждена / выполнена / отменена /
// в архив. Побочные эффекты завязаны на статус, а не на кнопку, чтобы работать
// одинаково из любого места ленты.
// Статус приходит первым аргументом через .bind() на кнопке: React НЕ кладёт
// name/value кнопки в FormData при formAction-функции — через name="status"
// сюда приходила пустота, и все кнопки статусов молча не работали.
export async function setStatusAction(status: string, formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const allowed = ["contacted", "confirmed", "done", "cancelled", "archived"];
  if (!id || !allowed.includes(status)) return;

  if (status === "done") await confirmPendingReward(id);

  const patch: Record<string, unknown> = { status };
  // Закрытые заявки не должны висеть закреплёнными сверху.
  if (status === "done" || status === "cancelled" || status === "archived") {
    patch.pinned = false;
  }
  await updateBooking(id, patch);
  if (status === "confirmed") await notifyInstructors(id).catch(() => {});
}

// ── Сессии (подэтап 4.2) ─────────────────────────────────────────────────────
// Сумма и дата в форме — как их вводит человек: «1 500 000», «1.500.000».
// Точка и запятая — ТОЛЬКО разделитель тысяч, поэтому требуем группы ровно по
// три цифры. Раньше разделители выкидывались без разбора, и «1.5» (в смысле
// «полтора миллиона») молча становилось чеком в 15 ₫ — без единой ошибки на
// экране. В донгах дробей не бывает: не угадываем, а возвращаем null, и
// вызывающий показывает «Сумма — число в донгах».
function parseVnd(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").replace(/\s/g, "");
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ""));
  return null;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Дата 'YYYY-MM-DD' из формы → момент timestamptz. Берём полночь UTC = 7 утра
// в Нячанге: дата остаётся «своим» днём и в UTC, и по местному времени.
function dayToIso(day: string): string {
  return new Date(`${day}T00:00:00Z`).toISOString();
}

// Клиент из формы: существующий (select clientId) ИЛИ новый по имени+телефону.
// Перед созданием ищем по телефону — та же логика гибкого сравнения цифр,
// что у инструктора, чтобы не плодить дублей из-за «+84» против «84».
//
// createdAt — момент, которым клиент появился у школы: дата занятия (или
// продажи абонемента), а НЕ «сейчас». При записи задним числом (перенос старой
// CRM, забытое занятие) клиент иначе считался бы новым в текущем месяце, и
// «Новых клиентов» на Статистике показывало бы всех перенесённых разом.
// В обычной работе дата занятия и есть сегодня — поведение не меняется.
async function resolveClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  adminId: string,
  formData: FormData,
  createdAt: string,
): Promise<{ id: string } | { error: string }> {
  const clientId = String(formData.get("clientId") ?? "");
  if (clientId) return { id: clientId };

  const name = String(formData.get("newName") ?? "").trim();
  const phone = String(formData.get("newPhone") ?? "").trim();
  if (!name || !phone) {
    return { error: "Выберите клиента из списка или заполните имя и телефон нового." };
  }
  const { data: existing } = await supabase
    .from("clients")
    .select("id, phone")
    .not("phone", "is", null)
    .limit(1000);
  const match = (existing ?? []).find((c) => phonesMatch(c.phone, phone));
  if (match) return { id: match.id };

  const { data: created, error } = await supabase
    .from("clients")
    .insert({
      name,
      phone: phoneDigits(phone) || phone,
      city: String(formData.get("newCity") ?? "").trim() || null,
      source: "offline",
      created_by: adminId,
      created_at: createdAt,
    })
    .select("id")
    .single();
  if (error || !created) {
    return { error: `Не удалось создать клиента: ${error?.message ?? "?"}` };
  }
  return { id: created.id };
}

// Скидка по агентской реф-ссылке — 200 000 ₫ на базовое обучение (как в
// кабинете инструктора). Применяется, когда админ записывает клиента из заявки.
const REF_DISCOUNT = 200_000;

// Создать сессию задним числом: инструктор забыл оформить занятие — админ
// вносит его вручную на любую дату. Тем же экшеном пользуется админская
// «Запись клиента» (может закрыть заявку и учесть реф-скидку/награду — см.
// bookingId ниже). Чек фиксируется в момент создания (изменение прайса в
// будущем прошлые сессии не трогает).
export async function createSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const date = String(formData.get("date") ?? "").trim();
  if (!DAY_RE.test(date)) return { error: "Укажите дату сессии." };

  const serviceId = String(formData.get("serviceId") ?? "");
  const instructorId = String(formData.get("instructorId") ?? "");
  if (!serviceId || !instructorId) {
    return { error: "Выберите услугу и инструктора." };
  }

  // Если запись закрывает заявку (админская «Запись клиента» из ?booking=id) —
  // тянем её реф-код и, если это активный агент, готовим скидку и награду, как
  // в кабинете инструктора. Форма сессий bookingId не шлёт — для неё блок no-op.
  //
  // Проверяем ДО создания клиента: иначе отказ ниже оставил бы клиента-сироту.
  const bookingId = String(formData.get("bookingId") ?? "") || null;
  let agent: { id: string; commission_fixed: number } | null = null;
  if (bookingId) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("status, ref_code")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return { error: "Заявка не найдена." };
    // Уже проведённую заявку вторично не оформляем: кнопка «Назад», повторный
    // сабмит или забытая вкладка со старым ?booking=id записывали ВТОРОЕ
    // занятие и ВТОРУЮ награду агенту — чек задваивался в выручке и ЗП.
    if (booking.status === "done") {
      return {
        error: "Эта заявка уже проведена — занятие записано. Смотрите вкладку «Сессии».",
      };
    }
    if (booking.ref_code) {
      const { data } = await supabase
        .from("agents")
        .select("id, commission_fixed")
        .eq("ref_code", booking.ref_code)
        .eq("active", true)
        .maybeSingle();
      agent = data ?? null;
    }
  }

  const { data: service } = await supabase
    .from("services")
    .select("price, category")
    .eq("id", serviceId)
    .maybeSingle();
  if (!service) return { error: "Услуга не найдена." };
  // Абонемент сессией не оформить: без своей формы клиент не получит минуты,
  // членство и отметку оплаты. Дубль-защита к фильтру списка на странице.
  if (service.category === "subscription") {
    return { error: "Абонемент оформляется на вкладке «Абонементы»." };
  }

  // Клиент — последним из проверок: всё, что могло отказать, уже отказало.
  // created_at = дате занятия (см. resolveClient).
  const clientRes = await resolveClient(supabase, admin.id, formData, dayToIso(date));
  if ("error" in clientRes) return clientRes;
  const clientId = clientRes.id;

  // Пустая сумма = по прайсу (с агентской скидкой −200к на базовое обучение);
  // введённая вручную — важнее (админ решает: скидки, брони, доплаты).
  const amountRaw = String(formData.get("amount") ?? "").trim();
  let amount: number | null;
  if (amountRaw) {
    amount = parseVnd(amountRaw);
  } else {
    amount = Number(service.price ?? 0);
    if (agent && service.category === "training") {
      amount = Math.max(0, amount - REF_DISCOUNT);
    }
  }
  if (amount === null) return { error: "Сумма — число в донгах, например 1 500 000." };

  const { error: insError } = await supabase.from("sessions").insert({
    client_id: clientId,
    service_id: serviceId,
    instructor_id: instructorId,
    date,
    amount,
    created_by: admin.id,
  });
  if (insError) return { error: `Не удалось создать сессию: ${insError.message}` };

  // Награда агенту (pending — подтвердится при статусе done или кнопкой) и
  // закрытие заявки: запись доведена до занятия.
  if (agent) {
    const { error: rewardError } = await supabase.from("referral_rewards").insert({
      referrer_type: "agent",
      referrer_id: agent.id,
      client_id: clientId,
      reward_type: "money",
      amount: agent.commission_fixed,
    });
    // Не кидаем: сессия уже записана. Ошибка «не сохранилось» толкнула бы
    // админа оформить занятие второй раз — получили бы дубль чека в выручке.
    // Награду в крайнем случае восстановит админ, дубль денег — нет.
    if (rewardError) console.error("[admin] reward insert error:", rewardError.message);
  }
  if (bookingId) {
    await supabase
      .from("bookings")
      .update({ status: "done", client_id: clientId })
      .eq("id", bookingId);
  }

  // Сессия влияет на выручку, статистику и ЗП — перерисовываем всё.
  revalidatePath("/", "layout");
  redirect("/admin/sessions");
}

// Правка сессии: дата / сумма / услуга / инструктор. Минуты списаний здесь
// не трогаем — для баланса абонемента есть корректировки с комментарием (4.3).
export async function updateSessionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const patch: Record<string, unknown> = {};
  const date = String(formData.get("date") ?? "").trim();
  if (DAY_RE.test(date)) patch.date = date;
  const amount = parseVnd(formData.get("amount"));
  if (amount !== null) patch.amount = amount;
  const instructorId = String(formData.get("instructorId") ?? "");
  if (instructorId) patch.instructor_id = instructorId;

  const supabase = await createClient();
  const serviceId = String(formData.get("serviceId") ?? "");
  if (serviceId) {
    // Ту же сессию нельзя ПЕРЕДЕЛАТЬ в абонемент — см. createSessionAction.
    const { data: svc } = await supabase
      .from("services")
      .select("category")
      .eq("id", serviceId)
      .maybeSingle();
    if (svc && svc.category !== "subscription") patch.service_id = serviceId;
  }
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from("sessions").update(patch).eq("id", id);
  failIfError(error, "не удалось сохранить сессию");
  revalidatePath("/", "layout");
}

// Удаление сессии: чек уходит из выручки и ЗП месяца. Если это списание минут
// с абонемента — минуты возвращаются (остаток считается по сессиям), статус
// абонемента пересчитывается.
export async function deleteSessionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: s } = await supabase
    .from("sessions")
    .select("subscription_id")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  failIfError(error, "не удалось удалить сессию");
  if (s?.subscription_id) {
    await recalcSubscriptionStatus(supabase, s.subscription_id);
  }
  revalidatePath("/", "layout");
}

// ── Абонементы (подэтап 4.3) ─────────────────────────────────────────────────
// Пересчёт статуса по остатку минут: кончились ↔ снова появились.
// Истёкший (expired) не воскрешаем.
async function recalcSubscriptionStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subId: string,
) {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id, total_minutes, status")
    .eq("id", subId)
    .maybeSingle();
  if (sub && (sub.status === "active" || sub.status === "used_up")) {
    const left = await minutesLeft(supabase, sub);
    const next = left <= 0 ? "used_up" : "active";
    if (next !== sub.status) {
      await supabase.from("subscriptions").update({ status: next }).eq("id", subId);
    }
  }
}

// Продажа от админа: как у инструктора, но продавца выбираем и дату можно
// поставить прошлую. Цена по умолчанию — 6 000 000 ₫. Продавец важен для ЗП:
// абонемент, проданный инструктором, кидает 15% в общий котёл (делится поровну
// между всеми инструкторами), а проданный админом — не кидает, это его прибыль.
export async function adminSellSubscriptionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const sellerId = String(formData.get("sellerId") ?? "");
  if (!sellerId) return { error: "Укажите, кто продал абонемент." };

  const soldDay = String(formData.get("soldDate") ?? "").trim();
  if (!DAY_RE.test(soldDay)) return { error: "Укажите дату продажи." };
  const soldAt = dayToIso(soldDay);

  const priceRaw = String(formData.get("price") ?? "").trim();
  const price = priceRaw ? parseVnd(priceRaw) : 6_000_000;
  if (price === null) return { error: "Цена — число в донгах, например 6 000 000." };

  // created_at клиента = дате продажи: абонемент, проданный задним числом, не
  // должен делать клиента «новым в этом месяце» (см. resolveClient).
  const clientRes = await resolveClient(supabase, admin.id, formData, soldAt);
  if ("error" in clientRes) return clientRes;
  const clientId = clientRes.id;

  // Минуты живут 3 месяца С ДАТЫ ПРОДАЖИ (в т.ч. прошлой). paid_at — только
  // при полученной оплате: от месяца оплаты зависят выручка и комиссия.
  const paid = formData.get("paid") === "on";
  const { error: subError } = await supabase.from("subscriptions").insert({
    client_id: clientId,
    sold_by: sellerId,
    price,
    sold_at: soldAt,
    expires_at: subscriptionExpiry(new Date(soldAt)).toISOString(),
    paid_at: paid ? soldAt : null,
  });
  if (subError) return { error: `Не удалось создать абонемент: ${subError.message}` };

  // Первый абонемент делает клиента членом клуба (как у инструктора).
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!membership) {
    const { error: memError } = await supabase
      .from("memberships")
      .insert({ client_id: clientId });
    // Не кидаем по той же причине, что и с наградой выше: абонемент уже продан,
    // а повтор формы создал бы второй на того же клиента. Членство добавляется
    // руками на вкладке «Члены клуба».
    if (memError) console.error("[admin] membership insert error:", memError.message);
  }

  revalidatePath("/", "layout");
  redirect("/admin/subscriptions");
}

// Тумблер оплаты. Поставить — с датой (по умолчанию сегодня; месяц оплаты
// решает, куда упадут выручка и комиссия). Снять — подтверждение на клиенте:
// отметка уже могла войти в расчёты.
export async function togglePaidAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  let paidAt: string | null = null;
  if (formData.get("set") === "1") {
    const day = String(formData.get("paidDate") ?? "").trim();
    paidAt = DAY_RE.test(day) ? dayToIso(day) : new Date().toISOString();
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ paid_at: paidAt })
    .eq("id", id);
  failIfError(error, "не удалось изменить отметку оплаты");
  revalidatePath("/", "layout");
}

// Ручная корректировка минут: только с комментарием (почему), пишется в лог
// subscription_adjustments от имени админа. Может вернуть абонемент из
// used_up в active (и наоборот), но не воскрешает истёкший.
export async function adjustMinutesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const subId = String(formData.get("subscriptionId") ?? "");
  const delta = Math.trunc(Number(formData.get("delta")));
  const comment = String(formData.get("comment") ?? "").trim();
  if (!subId || !Number.isFinite(delta) || delta === 0) {
    return { error: "Минуты — целое число, не ноль (например 30 или −15)." };
  }
  if (!comment) return { error: "Комментарий обязателен: почему меняем минуты." };

  const { error } = await supabase.from("subscription_adjustments").insert({
    subscription_id: subId,
    delta_minutes: delta,
    comment,
    created_by: admin.id,
  });
  if (error) return { error: `Не удалось сохранить корректировку: ${error.message}` };

  await recalcSubscriptionStatus(supabase, subId);

  revalidatePath("/", "layout");
  redirect("/admin/subscriptions");
}

// Удаление абонемента: вместе с ним удаляются его списания (иначе FK оставит
// «пустые» сессии без абонемента) и корректировки (cascade в БД). Выручка и
// комиссия месяца оплаты пересчитаются сами. Членство клиента не трогаем.
export async function deleteSubscriptionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error: sessionsError } = await supabase
    .from("sessions")
    .delete()
    .eq("subscription_id", id);
  failIfError(sessionsError, "не удалось удалить списания абонемента");
  const { error } = await supabase.from("subscriptions").delete().eq("id", id);
  failIfError(error, "не удалось удалить абонемент");
  revalidatePath("/", "layout");
}

// ── Клиенты (подэтап 4.4) ────────────────────────────────────────────────────
// Правка карточки клиента: имя, телефон, внутренняя заметка. Телефон храним
// цифрами (как resolveClient) — так работает дедуп при следующих оформлениях.
export async function updateClientAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  const phoneRaw = String(formData.get("phone") ?? "").trim();
  // Возраст: пусто или мусор → null («не указан»).
  const ageNum = Math.floor(Number(formData.get("age")));
  const supabase = await createClient();
  const { error } = await supabase
    .from("clients")
    .update({
      name,
      phone: phoneRaw ? phoneDigits(phoneRaw) || phoneRaw : null,
      age: Number.isFinite(ageNum) && ageNum > 0 ? ageNum : null,
      city: String(formData.get("city") ?? "").trim() || null,
      internal_note: String(formData.get("note") ?? "").trim() || null,
      tour_approved: formData.get("tour_approved") === "1",
    })
    .eq("id", id);
  failIfError(error, "не удалось сохранить карточку клиента");
  revalidatePath("/", "layout");
}

// ── Агенты (подэтап 4.5) ─────────────────────────────────────────────────────
// Реф-код: 6 строчных символов без похожих знаков (0/O, 1/l/I) — код диктуют
// вслух и набирают с телефона, путаница недопустима.
const REF_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function randomRefCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += REF_ALPHABET[Math.floor(Math.random() * REF_ALPHABET.length)];
  }
  return code;
}

// Новый агент: users (role=agent, БЕЗ auth_id — вход в систему ему не нужен,
// запись существует ради комиссии и статистики) + agents с уникальным реф-кодом.
// Комиссию не спрашиваем: default 300 000 ₫ задан в БД.
export async function createAgentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  if (!name) return { error: "Укажите имя агента." };

  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({
      role: "agent",
      name,
      phone: phone ? phoneDigits(phone) || phone : null,
    })
    .select("id")
    .single();
  if (userError || !user) {
    return { error: `Не удалось создать агента: ${userError?.message ?? "?"}` };
  }

  // Коллизия кода маловероятна (31^6 вариантов), но unique-индекс может её
  // поймать — тогда пробуем другой код, а не показываем ошибку человеку.
  let agentError: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase
      .from("agents")
      .insert({ user_id: user.id, ref_code: randomRefCode() });
    if (!error) {
      agentError = null;
      break;
    }
    agentError = error.message;
    if (error.code !== "23505") break; // не unique-конфликт — повтор не поможет
  }
  if (agentError) {
    // users-запись без agents бесполезна и замусорит базу — подчищаем.
    await supabase.from("users").delete().eq("id", user.id);
    return { error: `Не удалось создать агента: ${agentError}` };
  }

  revalidatePath("/", "layout");
  redirect("/admin/agents");
}

// Выключить/включить агента. Выключенный: лендинг /r/<код> перестаёт принимать
// гостей (мягкий редирект на /training), но история и награды остаются.
export async function toggleAgentActiveAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("agents")
    .update({ active: formData.get("active") !== "1" })
    .eq("id", id);
  failIfError(error, "не удалось переключить агента");
  revalidatePath("/", "layout");
}

// ── Члены клуба (подэтап 4.6) ────────────────────────────────────────────────
// Инвайт-ссылка: клиент купил абонемент офлайн → админ шлёт ему /invite/<token>
// в мессенджер → клиент ставит пароль и получает кабинет. Токен живёт 7 дней
// (default в БД), одноразовый (used_at). Повторное нажатие не плодит ссылки:
// живой неиспользованный токен переиспользуем.
export async function createInviteAction(formData: FormData) {
  const admin = await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("invite_tokens")
    .select("id")
    .eq("client_id", clientId)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  if (existing) return;

  // randomUUID без дефисов = 32 hex-символа; подобрать нереально, а в
  // мессенджере ссылка остаётся одной строкой.
  const { error } = await supabase.from("invite_tokens").insert({
    token: crypto.randomUUID().replace(/-/g, ""),
    client_id: clientId,
    created_by: admin.id,
  });
  failIfError(error, "не удалось создать инвайт-ссылку");
  revalidatePath("/", "layout");
}

// Сделать клиента членом клуба вручную. Обычно членство создаёт продажа
// абонемента; ручная кнопка — для случаев вроде «прошёл базовое обучение»
// (условия членства ещё уточняются у руководителя).
export async function addMemberAction(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId") ?? "");
  if (!clientId) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("memberships")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (existing) return;

  const { error } = await supabase.from("memberships").insert({ client_id: clientId });
  failIfError(error, "не удалось добавить члена клуба");
  revalidatePath("/", "layout");
}

// «Перенести»: новая дата/время, статус живой — в ленте появится бейдж
// «Перенесена» (по rescheduled_at), но запись продолжает свой цикл.
export async function rescheduleAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const date = String(formData.get("newDate") ?? "").trim();
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await updateBooking(id, {
    preferred_date: date,
    scheduled_time: String(formData.get("newTime") ?? "").trim() || null,
    rescheduled_at: new Date().toISOString(),
  });
}

// «Сохранить»: обновить поля уже подтверждённой записи, статус не трогаем.
export async function saveBookingAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await updateBooking(id, bookingFields(formData));
}

// «Закрепить/Открепить»: закреплённые записи висят сверху у инструкторов.
export async function togglePinAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await updateBooking(id, { pinned: formData.get("pinned") !== "1" });
}

// «Отменить»: клиент не придёт. Запись пропадает у инструкторов.
export async function cancelBookingAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await updateBooking(id, { status: "cancelled", pinned: false });
}

// ── Услуги (подэтап 4.10) ────────────────────────────────────────────────────
// Справочник services — источник для форм записи, сессий и статистики.
// Удаления нет: на услуги ссылаются bookings и sessions, вместо этого тумблер
// active. Категория задаётся один раз при создании — от неё зависит логика
// (subscription заблокирован в формах сессий).

const SERVICE_CATEGORIES = [
  "training",
  "tandem",
  "rental",
  "tour",
  "subscription",
  "extra",
];

// Правка названия, цены и длительности. Пустая цена/длительность = null
// («по запросу» / без фиксированной длительности).
export async function updateServiceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({
      name,
      price: parseVnd(formData.get("price")),
      duration_min: intOrNull(formData.get("duration")),
    })
    .eq("id", id);
  failIfError(error, "не удалось сохранить услугу");
  revalidatePath("/", "layout");
}

// Вкл/выкл: неактивная услуга исчезает из форм, история остаётся целой.
export async function toggleServiceActiveAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({ active: formData.get("active") !== "1" })
    .eq("id", id);
  failIfError(error, "не удалось переключить услугу");
  revalidatePath("/", "layout");
}

export async function createServiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "");
  if (!name) return { error: "Укажите название услуги." };
  if (!SERVICE_CATEGORIES.includes(category)) {
    return { error: "Выберите категорию." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("services").insert({
    name,
    category,
    price: parseVnd(formData.get("price")),
    duration_min: intOrNull(formData.get("duration")),
  });
  if (error) {
    return { error: `Не удалось создать услугу: ${error.message}` };
  }
  revalidatePath("/", "layout");
  redirect("/admin/services"); // redirect = чистая форма после успеха
}

// ── Материалы (фиксы после этапа 4) ──────────────────────────────────────────
// Каналы-метки из таблицы materials: ссылка /?src=<код> в рекламе → метка
// приходит с заявкой. Код метки: латиница/цифры/дефис, чтобы ссылка не ломалась.
const SRC_RE = /^[a-z0-9_-]{2,30}$/;

function materialFields(formData: FormData) {
  return {
    label: String(formData.get("label") ?? "").trim(),
    hint: String(formData.get("hint") ?? "").trim() || null,
    src: String(formData.get("src") ?? "").trim().toLowerCase(),
  };
}

export async function createMaterialAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const fields = materialFields(formData);
  if (!fields.label) return { error: "Укажите название канала." };
  if (!SRC_RE.test(fields.src)) {
    return { error: "Метка: 2–30 символов, латиница, цифры, дефис." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("materials").insert(fields);
  if (error) {
    return {
      error:
        error.code === "23505"
          ? `Метка «${fields.src}» уже занята.`
          : `Не удалось создать канал: ${error.message}`,
    };
  }
  revalidatePath("/", "layout");
  redirect("/admin/materials"); // redirect = чистая форма после успеха
}

export async function updateMaterialAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const fields = materialFields(formData);
  if (!id || !fields.label) return { error: "Укажите название канала." };
  if (!SRC_RE.test(fields.src)) {
    return { error: "Метка: 2–30 символов, латиница, цифры, дефис." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("materials").update(fields).eq("id", id);
  if (error) {
    return {
      error:
        error.code === "23505"
          ? `Метка «${fields.src}» уже занята.`
          : `Не удалось сохранить: ${error.message}`,
    };
  }
  revalidatePath("/", "layout");
  return { error: null };
}

// Удаление безопасно: bookings.src хранит метку текстом, FK нет — история
// заявок и статистика источников не трогаются.
export async function deleteMaterialAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("materials").delete().eq("id", id);
  failIfError(error, "не удалось удалить канал");
  revalidatePath("/", "layout");
}

// ── Расходы (пак E) ──────────────────────────────────────────────────────────
// Ручные (дополнительные) траты школы: аренда, топливо, инвентарь, реклама…
// Основные расходы (Marina 35%, ЗП 15%, Дэвид+Ромчик 2%) считаются на лету в
// lib/finance и здесь не хранятся.
export async function addExpenseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();

  const amount = parseVnd(formData.get("amount"));
  if (!amount || amount <= 0) return { error: "Укажите сумму расхода." };

  const dateRaw = String(formData.get("date") ?? "").trim();
  const date = DAY_RE.test(dateRaw) ? dateRaw : vnToday();

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    date,
    amount,
    category: String(formData.get("category") ?? "").trim() || null,
    comment: String(formData.get("comment") ?? "").trim() || null,
    created_by: admin.id,
  });
  if (error) return { error: `Не удалось добавить расход: ${error.message}` };

  revalidatePath("/", "layout");
  return { error: null };
}

export async function deleteExpenseAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  failIfError(error, "не удалось удалить расход");
  revalidatePath("/", "layout");
}

// ── Смены / выходы (пак H1) ───────────────────────────────────────────────────
// Админ ставит инструктору смену на день (планирование наперёд). unique-индекс
// (instructor_id, date) гасит дубли — повторный клик не создаёт вторую строку.
export async function assignShiftAction(formData: FormData) {
  const admin = await requireAdmin();
  const instructorId = String(formData.get("instructorId") ?? "");
  const date = String(formData.get("date") ?? "");
  if (!instructorId || !DAY_RE.test(date)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("shifts").insert({
    instructor_id: instructorId,
    date,
    note: String(formData.get("note") ?? "").trim() || null,
    created_by: admin.id,
  });
  // 23505 = смена уже стоит, это не ошибка (гонка/повторный клик).
  if (error?.code !== "23505") failIfError(error, "не удалось поставить смену");
  revalidatePath("/", "layout");
}

export async function removeShiftAction(formData: FormData) {
  await requireAdmin();
  const instructorId = String(formData.get("instructorId") ?? "");
  const date = String(formData.get("date") ?? "");
  if (!instructorId || !DAY_RE.test(date)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("shifts")
    .delete()
    .eq("instructor_id", instructorId)
    .eq("date", date);
  failIfError(error, "не удалось убрать смену");
  revalidatePath("/", "layout");
}
