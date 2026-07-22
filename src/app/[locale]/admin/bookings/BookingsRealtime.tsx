"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Живая лента заявок (пак 6): подписываемся на изменения таблицы bookings и на
// любое событие перерисовываем серверный список через router.refresh() — новые
// заявки всплывают и статусы меняются без ручного обновления страницы.
//
// Список остаётся серверным: refresh заново гоняет его логику на сервере и
// подменяет разметку, не теряя раскрытых карточек и позиции скролла. Права
// проверяет RLS (bookings_select_staff) — Realtime отдаёт события только тем,
// кому таблица видна на SELECT. Компонент ничего не рисует.

export function BookingsRealtime() {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Пачку быстрых изменений (подтверждение заявки дёргает несколько апдейтов
    // подряд) склеиваем одним refresh с небольшой задержкой.
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 300);
    };

    const channel = supabase
      .channel("admin-bookings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        refresh,
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
