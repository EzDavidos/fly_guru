"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { NAV_LINKS } from "./nav";

// Шапка сайта. Клиентский компонент ради мобильного меню и кнопки «Вход/Кабинет».
//
// Публичные страницы статические (SSG) — сервер не знает, кто залогинен.
// Поэтому сессию проверяем в браузере после загрузки: supabase читает её из
// куки локально, без похода в сеть. До проверки показываем «Вход» — у гостей
// (99% посетителей) ничего не мигает.
export function SiteHeader() {
  const [open, setOpen] = useState(false);
  // Куда ведёт кнопка кабинета: null = не залогинен (показываем «Вход»).
  const [cabinetHref, setCabinetHref] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      const role = session?.user.app_metadata?.role as string | undefined;
      if (role) setCabinetHref(`/${role}`); // /admin, /instructor, /member, /agent
    });
  }, []);

  const authHref = cabinetHref ?? "/login";
  const authLabel = cabinetHref ? "Кабинет" : "Вход";

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
            className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
          >
            {authLabel}
          </Link>
          <Link
            href="/training#form"
            className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
          >
            Записаться
          </Link>
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
            </Link>
            <Link
              href="/training#form"
              onClick={() => setOpen(false)}
              className="mt-2 mb-2 rounded-full bg-accent px-5 py-3 text-center font-semibold text-white"
            >
              Записаться
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
