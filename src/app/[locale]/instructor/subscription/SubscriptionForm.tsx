"use client";

import { useActionState } from "react";
import { sellSubscriptionAction, type ActionState } from "../actions";

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export interface SubscriptionPrefill {
  bookingId: string;
  name: string;
  phone: string;
  telegram: string | null;
}

export function SubscriptionForm({ prefill }: { prefill?: SubscriptionPrefill }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    sellSubscriptionAction,
    { error: null },
  );

  return (
    <form action={formAction} className="space-y-4">
      {prefill && (
        <>
          <input type="hidden" name="bookingId" value={prefill.bookingId} />
          {prefill.telegram && (
            <input type="hidden" name="telegramUsername" value={prefill.telegram} />
          )}
        </>
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

      {/* Типовой сценарий — оплата на месте (QR/крипта/наличные), поэтому
          переключатель включён по умолчанию. Если клиент платит позже —
          выключите, факт оплаты отметит админ. */}
      <label className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <input
          type="checkbox"
          name="paid"
          defaultChecked
          className="h-5 w-5 accent-[var(--color-accent,#0ea5e9)]"
        />
        <span className="text-sm font-medium">
          Оплата получена (QR / крипта / наличные)
        </span>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-full bg-accent px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
      >
        {pending ? "Оформляем…" : "Продать абонемент"}
      </button>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
