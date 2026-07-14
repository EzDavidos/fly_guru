"use client";

import { useActionState } from "react";
import { recordClientAction, type ActionState } from "../actions";

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export interface RecordPrefill {
  bookingId?: string;
  name?: string;
  phone?: string;
  serviceId?: string;
  refCode?: string | null;
}

interface RecordFormProps {
  services: { id: string; name: string }[];
  today: string; // 'YYYY-MM-DD' по Вьетнаму — с сервера, чтобы не зависеть от часов телефона
  prefill?: RecordPrefill;
}

export function RecordForm({ services, today, prefill }: RecordFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    recordClientAction,
    { error: null },
  );

  return (
    <form action={formAction} className="space-y-4">
      {prefill?.bookingId && (
        <input type="hidden" name="bookingId" value={prefill.bookingId} />
      )}

      {prefill?.refCode && (
        <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm font-medium text-accent-strong">
          Заявка по реф-ссылке «{prefill.refCode}» — на базовое обучение
          автоматически применится скидка 200 000 ₫.
        </p>
      )}

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Имя клиента *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={prefill?.name ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium">
          Телефон *
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          defaultValue={prefill?.phone ?? ""}
          className={inputClass}
        />
      </div>

      {/* Город — только для НОВОГО клиента (у существующего берётся из карточки
          и не перезаписывается). Необязательное поле. */}
      <div>
        <label htmlFor="city" className="mb-1 block text-sm font-medium">
          Город
        </label>
        <input
          id="city"
          name="city"
          type="text"
          placeholder="Nha Trang"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="serviceId" className="mb-1 block text-sm font-medium">
          Услуга *
        </label>
        <select
          id="serviceId"
          name="serviceId"
          required
          defaultValue={prefill?.serviceId ?? services[0]?.id ?? ""}
          className={inputClass}
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Инструктор записывает только текущим днём — дату не выбирают, просто
          показываем её. Записи задним числом делает админ. */}
      <div>
        <span className="mb-1 block text-sm font-medium">Дата занятия</span>
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-base text-muted">
          Сегодня, {today}
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-full bg-accent px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
      >
        {pending ? "Записываем…" : "Записать"}
      </button>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
