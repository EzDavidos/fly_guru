"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Живой счётчик заявок (пачка №5, п.6). Стоит в layout кабинета, поэтому
// подписка на таблицу bookings работает НА ВСЕХ разделах, а не только на
// странице заявок. На любое изменение зовём router.refresh() — layout заново
// считает freshCount, и красный бейдж на пункте «Заявки» обновляется без
// перезагрузки, где бы админ/инструктор сейчас ни находился.
//
// Права проверяет RLS (bookings_select_staff) — Realtime отдаёт события только
// тем, кому таблица видна на SELECT. Компонент ничего не рисует. channel —
// уникальное имя, чтобы подписки админа и инструктора не конфликтовали.

export function BookingsBadgeRefresh({ channel }: { channel: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Пачку быстрых апдейтов (подтверждение заявки дёргает несколько подряд)
    // склеиваем одним refresh с небольшой задержкой.
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 300);
    };

    const ch = supabase
      .channel(channel)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings" },
        refresh,
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(ch);
    };
  }, [router, channel]);

  return null;
}
