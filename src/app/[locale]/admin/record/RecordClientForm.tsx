"use client";

import { useActionState, useState } from "react";
import { createSessionAction } from "../actions";
import { vnd } from "@/lib/stats";

// Админская «Запись клиента». Отдельная форма (а не форма сессий), потому что
// инструктор по умолчанию — сам админ (он записывает и иногда сам катает), плюс
// поле города и возможность закрыть заявку. Постит в тот же createSessionAction.

interface Option {
  id: string;
  name: string;
}
interface ServiceOption extends Option {
  price: number;
}

export interface RecordPrefill {
  bookingId?: string;
  name?: string;
  phone?: string;
  serviceId?: string;
  refCode?: string | null;
}

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

export function RecordClientForm({
  services,
  staff,
  today,
  defaultInstructorId,
  prefill,
}: {
  services: ServiceOption[];
  staff: Option[];
  today: string;
  defaultInstructorId: string;
  prefill?: RecordPrefill;
}) {
  const [state, formAction, pending] = useActionState(createSessionAction, {
    error: null,
  });
  const [serviceId, setServiceId] = useState(
    prefill?.serviceId ?? services[0]?.id ?? "",
  );
  const price = services.find((s) => s.id === serviceId)?.price ?? 0;

  return (
    <form action={formAction} className="space-y-3">
      {prefill?.bookingId && (
        <input type="hidden" name="bookingId" value={prefill.bookingId} />
      )}

      {prefill?.refCode && (
        <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm font-medium text-accent-strong">
          Заявка по реф-ссылке «{prefill.refCode}» — если это код агента, к базовому
          обучению применится скидка 200 000 ₫ (при пустой сумме).
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Дата (можно прошлую)
          <input
            type="date"
            name="date"
            defaultValue={today}
            max={today}
            required
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="text-xs text-muted">
          Инструктор
          <select
            name="instructorId"
            defaultValue={defaultInstructorId}
            className={`mt-1 ${inputClass}`}
          >
            {staff.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Имя клиента *
          <input
            type="text"
            name="newName"
            required
            defaultValue={prefill?.name ?? ""}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <label className="text-xs text-muted">
          Телефон *
          <input
            type="tel"
            name="newPhone"
            required
            defaultValue={prefill?.phone ?? ""}
            className={`mt-1 ${inputClass}`}
          />
        </label>
      </div>

      <label className="block text-xs text-muted">
        Город
        <input type="text" name="newCity" placeholder="Nha Trang" className={`mt-1 ${inputClass}`} />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Услуга
          <select
            name="serviceId"
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            className={`mt-1 ${inputClass}`}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Сумма чека, ₫
          <input
            type="text"
            name="amount"
            inputMode="numeric"
            placeholder={`по прайсу: ${vnd(price)}`}
            className={`mt-1 ${inputClass}`}
          />
        </label>
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
      >
        {pending ? "Сохраняем…" : "Записать клиента"}
      </button>
    </form>
  );
}
