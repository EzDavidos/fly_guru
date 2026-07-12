"use client";

import { useEffect, useState } from "react";

// Номер заявки из ?no=… — читаем в браузере, чтобы страница «спасибо»
// осталась статической (SSG): сервер номера не знает, а клиенту он нужен,
// чтобы назвать его при созвоне.
export function BookingNo() {
  const [no, setNo] = useState<string | null>(null);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("no");
    if (raw && /^\d+$/.test(raw)) setNo(raw);
  }, []);

  if (!no) return null;

  return (
    <p className="mt-4 inline-block rounded-full bg-primary/10 px-5 py-2 font-semibold text-primary">
      Номер вашей заявки: #{no}
    </p>
  );
}
