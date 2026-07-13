"use client";

import type { ReactNode } from "react";

// Submit с браузерным confirm() — для действий, которые трогают уже
// посчитанные деньги (снятие отметки оплаты, удаление сессий и абонементов).
export function ConfirmSubmit({
  message,
  className,
  children,
}: {
  message: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
