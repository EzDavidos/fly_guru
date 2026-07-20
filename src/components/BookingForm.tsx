"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "@/i18n/navigation";
import { getAttributionForBooking } from "@/lib/attribution";
import { isValidPhone, PHONE_ERROR } from "@/lib/phone";

// Услуга в том минимальном виде, что нужен форме: id (для базы) + название.
export interface ServiceOption {
  id: string;
  name: string;
}

interface BookingFormProps {
  services: ServiceOption[]; // список услуг для выпадающего списка (из базы)
  defaultServiceId?: string; // какая услуга выбрана заранее (зависит от страницы)
  refCode?: string; // реф-код (на лендинге /r/[code]) — вшивается скрыто в заявку
}

// Каналы связи: по какому мессенджеру гостю удобнее, чтобы админ не гадал.
const MESSENGERS = ["WhatsApp", "Telegram", "Zalo"] as const;

// Общие классы полей ввода — чтобы все поля выглядели одинаково и в стиле сайта.
const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

type Status = "idle" | "submitting" | "error" | "badPhone";

export function BookingForm({ services, defaultServiceId, refCode }: BookingFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [phone, setPhone] = useState("");

  // Показываем ошибку только после того, как гость начал печатать: пустое
  // поле при загрузке страницы не должно краснеть.
  const phoneBad = phone.trim().length > 0 && !isValidPhone(phone);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Отсекаем мусор до сети: иначе гость ждёт ответа сервера, чтобы узнать
    // то, что видно прямо здесь.
    if (!isValidPhone(phone)) {
      setStatus("badPhone");
      return;
    }
    setStatus("submitting");

    // Собираем значения полей из формы.
    const form = e.currentTarget;
    const data = new FormData(form);

    // Метки источника, которые мы запомнили при заходе (localStorage).
    // Если мы на реф-лендинге — код из ссылки главнее.
    const attribution = getAttributionForBooking();
    const payload = {
      clientName: String(data.get("clientName") ?? ""),
      contact: String(data.get("contact") ?? ""),
      telegram: String(data.get("telegram") ?? ""),
      messenger: String(data.get("messenger") ?? ""),
      serviceId: String(data.get("serviceId") ?? ""),
      preferredDate: String(data.get("preferredDate") ?? ""),
      comment: String(data.get("comment") ?? ""),
      honeypot: String(data.get("company") ?? ""), // поле-ловушка (см. ниже)
      ref_code: refCode || attribution.ref_code,
      src: attribution.src,
      utm: attribution.utm,
    };

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("request failed");
      // Успех — уводим на страницу «спасибо» (с номером заявки, если сервер
      // его вернул: клиент сможет назвать номер при созвоне).
      const { bookingNo } = (await res.json()) as { bookingNo?: number | null };
      router.push(bookingNo ? `/thanks?no=${bookingNo}` : "/thanks");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Поле-ловушка (honeypot). Живой человек его не видит (скрыто стилями),
          а бот часто заполняет все поля. Если сюда что-то попало — сервер
          отбросит заявку как спам. aria-hidden + tabIndex убирают его от
          скринридеров и клавиатуры. */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label>
          Не заполняйте это поле
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <label htmlFor="clientName" className="mb-1 block text-sm font-medium">
          Имя *
        </label>
        <input id="clientName" name="clientName" type="text" required className={inputClass} />
      </div>

      {/* Телефон и ник — раздельно. Раньше это было одно поле «телефон ИЛИ
          ник», и заявки приходили без номера: позвонить было некому, а понять
          это удавалось только вручную. */}
      <div>
        <label htmlFor="contact" className="mb-1 block text-sm font-medium">
          Телефон *
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="contact"
            name="contact"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+84 90 123 45 67"
            aria-invalid={phoneBad || undefined}
            className={`${inputClass} sm:flex-1`}
          />
          <select name="messenger" defaultValue={MESSENGERS[0]} className={`${inputClass} sm:w-40`}>
            {MESSENGERS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-sm text-muted">
          Номер для WhatsApp или Telegram — по нему свяжемся с вами.
        </p>
        {phoneBad && <p className="mt-1 text-sm text-red-600">{PHONE_ERROR}</p>}
      </div>

      <div>
        <label htmlFor="telegram" className="mb-1 block text-sm font-medium">
          Ник в Telegram
        </label>
        <input
          id="telegram"
          name="telegram"
          type="text"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="@username"
          className={inputClass}
        />
        <p className="mt-1 text-sm text-muted">
          Необязательно — если номер не отвечает, напишем сюда.
        </p>
      </div>

      <div>
        <label htmlFor="serviceId" className="mb-1 block text-sm font-medium">
          Услуга
        </label>
        <select
          id="serviceId"
          name="serviceId"
          defaultValue={defaultServiceId ?? services[0]?.id ?? ""}
          className={inputClass}
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="preferredDate" className="mb-1 block text-sm font-medium">
          Желаемая дата
        </label>
        <input id="preferredDate" name="preferredDate" type="date" className={inputClass} />
      </div>

      <div>
        <label htmlFor="comment" className="mb-1 block text-sm font-medium">
          Комментарий
        </label>
        <textarea id="comment" name="comment" rows={3} className={inputClass} />
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex w-full items-center justify-center rounded-full bg-accent px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60 sm:w-auto"
      >
        {status === "submitting" ? "Отправляем…" : "Записаться"}
      </button>

      {status === "badPhone" && (
        <p className="text-sm text-red-600">{PHONE_ERROR}</p>
      )}

      {status === "error" && (
        <p className="text-sm text-red-600">
          Не удалось отправить. Проверьте соединение и попробуйте ещё раз, либо напишите нам в мессенджер.
        </p>
      )}
    </form>
  );
}
