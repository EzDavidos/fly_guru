"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

// Живой счётчик заявок (пачка №5, п.6). Стоит в layout кабинета, поэтому
// работает НА ВСЕХ разделах, а не только на странице заявок. На любое изменение
// зовём router.refresh() — layout заново считает freshCount, страница
// перечитывает свой список, и красный бейдж на пункте «Заявки» обновляется без
// перезагрузки, где бы админ/инструктор сейчас ни находился.
//
// Права проверяет RLS (bookings_select_staff) — Realtime отдаёт события только
// тем, кому таблица видна на SELECT. Компонент ничего не рисует. channel —
// уникальное имя, чтобы подписки админа и инструктора не конфликтовали.
//
// Почему одной подписки мало (пачка №6, п.3). Вебсокет живёт, пока живёт
// вкладка, а телефон её усыпляет: свернул браузер — соединение оборвалось,
// вернулся — страница осталась такой, какой была. Отсюда обе жалобы сразу:
// у админа «красный бейдж иногда не появляется» (событие пришло, пока вкладка
// спала) и у инструктора «обработанная заявка не исчезает» (нажал «Записать
// клиента», вернулся кнопкой «назад» — телефон показал сохранённую копию
// страницы, не спрашивая сервер). Поэтому три страховки:
//   1) обновляемся при возвращении к вкладке — visibilitychange / focus /
//      pageshow (последнее ловит именно «назад» из кэша браузера);
//   2) редкий фоновый опрос, пока вкладка открыта — на случай, если сокет
//      молча умер (протух токен, моргнула связь);
//   3) переподписка при обрыве канала, с обновлением данных после неё —
//      за время обрыва заявки могли измениться.

// Раз в минуту: сокет и так приносит изменения мгновенно, это лишь сеть
// безопасности. Чаще не нужно — каждый refresh пересчитывает финансы месяца
// в шапке админки.
const POLL_MS = 60_000;

// Пауза перед восстановлением оборванного канала, чтобы при пропавшем интернете
// не долбиться в сервер без остановки.
const RETRY_MS = 5_000;

export function BookingsBadgeRefresh({ channel }: { channel: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    let debounce: ReturnType<typeof setTimeout> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let ch: RealtimeChannel | null = null;
    let broken = false; // канал рвался — после восстановления надо перечитать данные
    let stopped = false; // компонент размонтирован, ничего больше не делаем

    // Пачку быстрых апдейтов (подтверждение заявки дёргает несколько подряд)
    // склеиваем одним refresh с небольшой задержкой.
    const refresh = () => {
      if (stopped) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => router.refresh(), 300);
    };

    const subscribe = () => {
      if (stopped) return;
      ch = supabase
        .channel(channel)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bookings" },
          refresh,
        )
        .subscribe((status) => {
          if (stopped) return;
          if (status === "SUBSCRIBED") {
            if (broken) {
              broken = false;
              refresh(); // пока канала не было, могли прийти новые заявки
            }
            return;
          }
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            broken = true;
            if (retry) clearTimeout(retry);
            retry = setTimeout(() => {
              if (stopped) return;
              if (ch) supabase.removeChannel(ch);
              ch = null;
              subscribe();
            }, RETRY_MS);
          }
        });
    };

    subscribe();

    // Вернулись к вкладке — данные могли устареть, перечитываем. Скрытую
    // вкладку не трогаем: она всё равно ничего не показывает.
    const onWake = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("pageshow", onWake);

    const poll = setInterval(onWake, POLL_MS);

    return () => {
      stopped = true;
      if (debounce) clearTimeout(debounce);
      if (retry) clearTimeout(retry);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("pageshow", onWake);
      if (ch) supabase.removeChannel(ch);
    };
  }, [router, channel]);

  return null;
}
