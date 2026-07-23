"use client";

import { useEffect, useRef } from "react";
import { BookingForm, type ServiceOption } from "./BookingForm";

// Модалка записи: затемнённый + размытый фон (внимание на форме), панель по
// центру с той же самой BookingForm. Закрытие — крестик, клик по фону, Esc.
// Пока открыта, скролл страницы под ней заблокирован.

export function BookingModal({
  services,
  defaultServiceId,
  refCode,
  onClose,
}: {
  services: ServiceOption[];
  defaultServiceId?: string;
  refCode?: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Гасим скролл фона, чтобы страница под модалкой не «уезжала».
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    // Фокус на имя (не на honeypot и не на крестик) — сразу можно печатать.
    panelRef.current?.querySelector<HTMLElement>("#clientName")?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Запись"
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm sm:items-center"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="relative my-8 w-full max-w-lg rounded-3xl border border-line bg-surface p-6 shadow-xl sm:p-8"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-primary hover:text-primary"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold">Запись</h2>

        {/* Без подзаголовка: первым делом гость должен видеть поле «Имя», а не
            ещё одну строку текста (пачка №5, п.2). */}
        <div className="mt-4">
          <BookingForm
            services={services}
            defaultServiceId={defaultServiceId}
            refCode={refCode}
            onSuccess={onClose}
          />
        </div>
      </div>
    </div>
  );
}
