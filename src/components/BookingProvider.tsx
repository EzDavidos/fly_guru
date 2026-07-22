"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { ServiceOption } from "./BookingForm";
import { BookingModal } from "./BookingModal";

// Единая форма записи на весь сайт (пак 5). Один инстанс формы живёт здесь, в
// модалке поверх страницы; любая кнопка «Записаться» открывает её через
// контекст, а не скроллит к секции. Список услуг — все активные (любой формат
// проката), грузится один раз в layout и передаётся сюда.

interface OpenOpts {
  serviceId?: string; // какую услугу выбрать заранее (зависит от кнопки)
  refCode?: string; // реф-код (кнопки на лендинге /r/[code])
}

interface BookingContext {
  open: (opts?: OpenOpts) => void;
}

const Ctx = createContext<BookingContext | null>(null);

// Хук для кнопок: открыть модалку записи. Кидает, если забыли обернуть в
// провайдер — так ошибку видно сразу в разработке, а не молчаливым no-op.
export function useBooking(): BookingContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBooking must be used within <BookingProvider>");
  return ctx;
}

export function BookingProvider({
  services,
  children,
}: {
  services: ServiceOption[];
  children: ReactNode;
}) {
  const [state, setState] = useState<{
    open: boolean;
    serviceId?: string;
    refCode?: string;
  }>({ open: false });

  const open = useCallback(
    (opts?: OpenOpts) => setState({ open: true, ...opts }),
    [],
  );
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {state.open && (
        <BookingModal
          services={services}
          defaultServiceId={state.serviceId}
          refCode={state.refCode}
          onClose={close}
        />
      )}
    </Ctx.Provider>
  );
}
