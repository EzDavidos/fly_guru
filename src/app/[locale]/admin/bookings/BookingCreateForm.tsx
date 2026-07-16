"use client";

import { useActionState, useState } from "react";
import { createBookingAction } from "../actions";
import { MANUAL_CHANNELS } from "@/lib/channels";

// Форма «Новая заявка»: клиент позвонил / написал / пришёл ногами. Заявку с
// сайта создаёт публичная форма, а этот поток раньше в CRM не попадал вообще.
// Клиентский компонент ради двух вещей: показать ошибку валидации без
// перезагрузки и свернуть форму, чтобы она не занимала ленту постоянно.

export interface ServiceOption {
  id: string;
  name: string;
}

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

export function BookingCreateForm({
  services,
  today,
}: {
  services: ServiceOption[];
  today: string;
}) {
  const [state, formAction, pending] = useActionState(createBookingAction, {
    error: null,
  });
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-line px-4 py-3 text-sm font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
      >
        + Новая заявка (звонок, мессенджер, пришёл сам)
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-2xl border border-line bg-surface p-4"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">Новая заявка</h2>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-muted transition-colors hover:text-foreground"
        >
          Свернуть
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Имя клиента
          <input type="text" name="clientName" required className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-xs text-muted">
          Телефон
          <input type="tel" name="phone" required className={`mt-1 ${inputClass}`} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Откуда пришёл
          <select name="channel" defaultValue="call" className={`mt-1 ${inputClass}`}>
            {Object.entries(MANUAL_CHANNELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Услуга
          <select name="serviceId" className={`mt-1 ${inputClass}`}>
            <option value="">— не выбрана —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Дата (можно будущую)
          <input
            type="date"
            name="preferredDate"
            defaultValue={today}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="text-xs text-muted">
          Время
          <input type="time" name="scheduledTime" className={`mt-1 ${inputClass}`} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Возраст
          <input type="number" name="age" min={1} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-xs text-muted">
          Вес, кг
          <input type="number" name="weight" min={1} className={`mt-1 ${inputClass}`} />
        </label>
      </div>

      <label className="block text-xs text-muted">
        Комментарий
        <input
          type="text"
          name="note"
          placeholder="о чём договорились"
          className={`mt-1 ${inputClass}`}
        />
      </label>

      {/* По умолчанию сразу «Подтверждена»: по телефону уже договорились, и
          запись должна тут же попасть в календарь и к инструкторам. */}
      <label className="block text-xs text-muted">
        Статус
        <select name="status" defaultValue="confirmed" className={`mt-1 ${inputClass}`}>
          <option value="confirmed">Подтверждена — сразу в календарь</option>
          <option value="new">Новая — ещё созвониться</option>
        </select>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
      >
        {pending ? "Сохраняем…" : "Создать заявку"}
      </button>
    </form>
  );
}
