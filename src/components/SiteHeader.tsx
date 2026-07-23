"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { useBooking } from "./BookingProvider";
import { NAV_LINKS } from "./nav";

// Шапка сайта. Клиентский компонент ради мобильного меню и кнопки «Вход/Кабинет».
//
// Публичные страницы статические (SSG) — сервер не знает, кто залогинен.
// Поэтому сессию проверяем в браузере после загрузки: supabase читает её из
// куки локально, без похода в сеть. До проверки показываем «Вход» — у гостей
// (99% посетителей) ничего не мигает.
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { open: openBooking } = useBooking();
  // Куда ведёт кнопка кабинета: null = не залогинен (показываем «Вход»).
  const [cabinetHref, setCabinetHref] = useState<string | null>(null);
  // Активные записи (подтверждены админом, никем не приняты) — красный
  // кружочек на кнопке «Кабинет» у инструктора и админа.
  const [activeCount, setActiveCount] = useState(0);
  const pathname = usePathname();

  // Пересчёт при каждой смене страницы и при возврате во вкладку — раньше
  // цифра считалась один раз при загрузке и «застревала».
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const refresh = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled || !session) return;

      // Роль спрашиваем у базы, а НЕ у JWT (app_metadata.role). Токен в браузере
      // отстаёт: у повышенного до admin инструктора он до ближайшего обновления
      // всё ещё говорит «instructor» — и кнопка вела в чужой кабинет, куда
      // middleware спокойно пускал (роль в токене совпала с разделом). Запрос
      // уходит только у залогиненных; RLS users_select_own отдаёт свою строку.
      const { data: row } = await supabase
        .from("users")
        .select("role")
        .eq("auth_id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      const role = row?.role as string | undefined;
      if (!role) return;
      setCabinetHref(`/${role}`); // /admin, /instructor, /member, /agent

      if (role === "instructor" || role === "admin") {
        // RLS (bookings_select_staff) пропустит только персонал.
        // Инструктору важны непринятые записи, админу — свежие заявки с сайта.
        let q = supabase
          .from("bookings")
          .select("id", { count: "exact", head: true });
        q =
          role === "admin"
            ? q.eq("status", "new")
            : q.eq("status", "confirmed").is("accepted_by", null);
        const { count } = await q;
        if (!cancelled) setActiveCount(count ?? 0);
      }
    };

    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pathname]);

  const authHref = cabinetHref ?? "/login";
  const authLabel = cabinetHref ? "Кабинет" : "Вход";

  const countBubble = activeCount > 0 && (
    <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
      {activeCount}
    </span>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold" onClick={() => setOpen(false)}>
          <Image
            src="/brand/flyguru-logo.jpg"
            alt="FlyGuru"
            width={36}
            height={36}
            className="rounded-full"
            priority
          />
          <span className="text-lg">FlyGuru</span>
        </Link>

        {/* Десктоп-навигация */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm text-muted hover:text-ink">
              {l.label}
            </Link>
          ))}
          <Link
            href={authHref}
            className="relative rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
          >
            {authLabel}
            {countBubble}
          </Link>
          <button
            type="button"
            onClick={() => openBooking()}
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
          >
            Записаться
          </button>
        </nav>

        {/* Кнопка мобильного меню */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Меню"
          aria-expanded={open}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line md:hidden"
        >
          <span className="text-xl leading-none">{open ? "✕" : "☰"}</span>
        </button>
      </div>

      {/* Мобильное меню */}
      {open && (
        <nav className="border-t border-line bg-surface md:hidden">
          <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-2 sm:px-6">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="border-b border-line/70 py-3 text-muted hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={authHref}
              onClick={() => setOpen(false)}
              className="py-3 text-muted hover:text-ink"
            >
              {cabinetHref ? "Мой кабинет" : "Вход в кабинет"}
              {activeCount > 0 && (
                <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                  {activeCount}
                </span>
              )}
            </Link>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                openBooking();
              }}
              className="mt-2 mb-2 rounded-full bg-accent px-5 py-3 text-center font-semibold text-white"
            >
              Записаться
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
