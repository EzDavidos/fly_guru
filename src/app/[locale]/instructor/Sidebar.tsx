"use client";

import { useState } from "react";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
import { logoutAction } from "../login/actions";

// Боковое меню кабинета инструктора. На ПК — узкая колонка слева (sticky),
// на телефоне сворачивается в верхнюю плашку «текущий блок ▸ Меню».
// Активный блок подсвечивается (сравниваем с usePathname).

type NavItem = {
  href: string;
  label: string;
  hint?: string;
  badge?: number;
};

const NAV: NavItem[] = [
  { href: "/instructor/bookings", label: "Записи", hint: "от админа" },
  { href: "/instructor/record", label: "Записать клиента", hint: "новая сессия" },
  { href: "/instructor/stats", label: "Статистика", hint: "за любой период" },
  { href: "/instructor/subscription", label: "Абонемент", hint: "продажа" },
  { href: "/instructor/writeoff", label: "Списание", hint: "минуты" },
  { href: "/instructor/settings", label: "Настройки", hint: "имя · фото · цель" },
];

function CountBubble({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
      {count}
    </span>
  );
}

export function Sidebar({
  name,
  photoUrl,
  amountLabel,
  amountSub,
  activeCount,
}: {
  name: string;
  photoUrl: string | null;
  amountLabel: string;
  amountSub: string;
  activeCount: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const withBadges = NAV.map((item) =>
    item.href === "/instructor/bookings" ? { ...item, badge: activeCount } : item,
  );
  const active =
    withBadges.find((item) => pathname.startsWith(item.href)) ?? withBadges[0];

  const profile = (
    <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-line bg-surface p-4">
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={name}
          width={48}
          height={48}
          className="h-12 w-12 shrink-0 rounded-full object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          {name.trim().charAt(0).toUpperCase() || "?"}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">{name}</p>
        <p className="truncate text-lg font-bold text-primary">{amountLabel}</p>
        <p className="truncate text-xs text-muted">{amountSub}</p>
      </div>
    </div>
  );

  const links = (
    <nav className="flex flex-col gap-1">
      {withBadges.map((item) => {
        const isActive = item.href === active.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              isActive
                ? "bg-primary text-white"
                : "text-foreground hover:bg-line/50"
            }`}
          >
            <span className="min-w-0">
              <span className="block truncate">{item.label}</span>
              {item.hint && (
                <span
                  className={`block truncate text-xs font-normal ${
                    isActive ? "text-white/70" : "text-muted"
                  }`}
                >
                  {item.hint}
                </span>
              )}
            </span>
            {item.badge ? <CountBubble count={item.badge} /> : null}
          </Link>
        );
      })}
      <form action={logoutAction} className="mt-1">
        <button
          type="submit"
          className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-muted transition-colors hover:bg-line/50"
        >
          Выход
        </button>
      </form>
    </nav>
  );

  return (
    <aside className="md:h-full md:w-64 md:shrink-0">
      {/* ПК: колонка на всю высоту со своим скроллом (не уезжает с контентом) */}
      <div className="scroll-soft hidden md:flex md:h-full md:flex-col md:gap-4 md:overflow-y-auto md:overscroll-contain md:py-6 md:pr-1">
        {profile}
        {links}
      </div>

      {/* Телефон: плашка текущего блока + разворачиваемое меню */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 font-semibold">
            {active.label}
            {active.badge ? <CountBubble count={active.badge} /> : null}
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-primary">
            Меню <span aria-hidden>{open ? "▲" : "▼"}</span>
          </span>
        </button>
        {open && (
          <div className="mt-2 space-y-3">
            {profile}
            {links}
          </div>
        )}
      </div>
    </aside>
  );
}
