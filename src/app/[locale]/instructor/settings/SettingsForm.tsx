"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { updateProfileAction, type ActionState } from "../actions";

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

// Дублирует AVATAR_MAX_BYTES из actions.ts (см. комментарий там).
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

export function SettingsForm({
  name,
  photoUrl,
  age,
  monthlyGoal,
}: {
  name: string;
  photoUrl: string | null;
  age: number | null;
  monthlyGoal: number | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateProfileAction,
    { error: null },
  );

  // Локальный предпросмотр выбранного фото (до отправки на сервер).
  const [preview, setPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      setPhotoError(null);
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Фото больше 4 МБ. Выберите другое или сожмите.");
      e.target.value = "";
      setPreview(null);
      return;
    }
    setPhotoError(null);
    setPreview(URL.createObjectURL(file));
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* Фото: кружок-предпросмотр + нативный выбор файла (на телефоне
          откроет галерею/камеру) */}
      <div className="flex items-center gap-4">
        {preview ? (
          // Предпросмотр — это локальный blob:-URL, next/image с ним не работает.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Новое фото"
            className="h-18 w-18 shrink-0 rounded-full object-cover"
          />
        ) : photoUrl ? (
          <Image
            src={photoUrl}
            alt={name}
            width={72}
            height={72}
            className="h-18 w-18 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
            {name.trim().charAt(0).toUpperCase() || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <label htmlFor="photo" className="mb-1 block text-sm font-medium">
            Фото
          </label>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPhotoChange}
            className="w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary"
          />
          {photoError && <p className="mt-1 text-sm text-red-600">{photoError}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Отображаемое имя *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={name}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="age" className="mb-1 block text-sm font-medium">
          Возраст
        </label>
        <input
          id="age"
          name="age"
          type="number"
          inputMode="numeric"
          min={14}
          max={99}
          defaultValue={age ?? ""}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="monthly_goal" className="mb-1 block text-sm font-medium">
          Цель по ЗП на месяц, ₫
        </label>
        <input
          id="monthly_goal"
          name="monthly_goal"
          type="text"
          inputMode="numeric"
          placeholder="20 000 000"
          defaultValue={monthlyGoal ?? ""}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted">
          Пустое поле — прогресс-бар на главном экране не показывается.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center rounded-full bg-accent px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-60"
      >
        {pending ? "Сохраняем…" : "Сохранить"}
      </button>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
