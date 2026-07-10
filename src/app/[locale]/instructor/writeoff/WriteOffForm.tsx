"use client";

import { useActionState } from "react";
import { writeOffAction, type ActionState } from "../actions";

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function WriteOffForm({
  clientId,
  clientName,
  left,
}: {
  clientId: string;
  clientName: string;
  left: number;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    writeOffAction,
    { error: null },
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="clientName" value={clientName} />

      <div>
        <label htmlFor="minutes" className="mb-1 block text-sm font-medium">
          Минут каталки
        </label>
        <input
          id="minutes"
          name="minutes"
          type="number"
          inputMode="numeric"
          min={1}
          max={left}
          step={1}
          required
          placeholder="30"
          className={`${inputClass} text-2xl font-bold`}
        />
      </div>

      <button
        type="submit"
        disabled={pending || left <= 0}
        className="inline-flex w-full items-center justify-center rounded-full bg-accent px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
      >
        {pending ? "Списываем…" : "Списать минуты"}
      </button>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
