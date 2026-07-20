"use client";

import Image from "next/image";
import { useActionState } from "react";
import { uploadClientPhotoAction } from "../actions";
import { PHOTO_ACCEPT } from "@/lib/photos";

// Фото клиента (пак B, пункт 7). Отдельная форма от карточки: та сохраняется
// без файлов, и тащить фото через каждое сохранение заметки незачем.
//
// capture не ставим намеренно: админ работает за компьютером и выбирает уже
// сделанный снимок. Съёмка «прямо сейчас» появится там, где она нужна, — на
// телефоне инструктора (пак C).

export function ClientPhoto({
  clientId,
  photoUrl,
  name,
}: {
  clientId: string;
  photoUrl: string | null;
  name: string;
}) {
  const [state, formAction, pending] = useActionState(uploadClientPhotoAction, {
    error: null,
  });

  return (
    <div className="flex items-start gap-3">
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={name}
          width={64}
          height={64}
          className="h-16 w-16 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
          {name.trim().charAt(0).toUpperCase() || "?"}
        </div>
      )}
      <form action={formAction} className="min-w-0 flex-1">
        <input type="hidden" name="id" value={clientId} />
        <label className="block text-xs text-muted">
          {photoUrl ? "Заменить фото" : "Фото клиента"}
          <input
            type="file"
            name="photo"
            accept={PHOTO_ACCEPT}
            required
            className="mt-1 block w-full text-xs text-muted file:mr-3 file:rounded-full file:border-0 file:bg-line/50 file:px-3 file:py-1.5 file:text-xs file:font-semibold"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
        >
          {pending ? "Загружаем…" : "Загрузить"}
        </button>
        {state.error && (
          <p className="mt-1 text-xs text-red-600">{state.error}</p>
        )}
      </form>
    </div>
  );
}
