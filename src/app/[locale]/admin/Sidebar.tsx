"use client";

import { useState } from "react";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
import { logoutAction } from "../login/actions";

// Боковое меню админки. На ПК — узкая колонка слева (sticky). На телефоне —
// фиксированная нижняя панель с 4 главными разделами + «Ещё» (лист со всеми
// остальными). Активный блок подсвечивается (сравниваем с usePathname).
//
// primary — раздел выносится в нижнюю панель на телефоне; short — короткая
// подпись для узкой ячейки этой панели.

type NavItem = {
  href: string;
  label: string;
  short?: string;
  hint?: string;
  primary?: boolean;
  badge?: number;
};

const NAV: NavItem[] = [
  { href: "/admin/bookings", label: "Заявки", hint: "актуальные", primary: true },
  { href: "/admin/record", label: "Записать клиента", short: "Записать", hint: "провести занятие", primary: true },
  { href: "/admin/calendar", label: "Календарь", hint: "смены · записи по дням", primary: true },
  { href: "/admin/sessions", label: "Сессии", hint: "занятия · задним числом" },
  { href: "/admin/subscriptions", label: "Абонементы", hint: "оплаты · минуты" },
  { href: "/admin/clients", label: "Клиенты", hint: "поиск · карточки" },
  { href: "/admin/agents", label: "Агенты", hint: "реф-ссылки · награды" },
  { href: "/admin/members", label: "Члены клуба", hint: "инвайты · кабинеты" },
  { href: "/admin/materials", label: "Материалы", hint: "ссылки для рекламы" },
  { href: "/admin/dashboard", label: "Статистика", hint: "месяц цифрами", primary: true },
  { href: "/admin/payroll", label: "Расчёт месяца", hint: "ЗП · агенты · CSV" },
  { href: "/admin/expenses", label: "Расходы", hint: "марина · зп · прочее" },
  { href: "/admin/services", label: "Услуги", hint: "цены · справочник" },
  { href: "/admin/settings", label: "Настройки", hint: "имя · фото" },
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
  freshCount,
}: {
  name: string;
  photoUrl: string | null;
  amountLabel: string;
  amountSub: string;
  freshCount: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const withBadges = NAV.map((item) =>
    item.href === "/admin/bookings" ? { ...item, badge: freshCount } : item,
  );
  const active =
    withBadges.find((item) => pathname.startsWith(item.href)) ?? withBadges[0];
  // Нижняя панель телефона: главные разделы + «Ещё». «Ещё» подсвечиваем, когда
  // открыт раздел не из панели (или лист развёрнут).
  const primaryItems = withBadges.filter((item) => item.primary);
  const moreActive = !primaryItems.some((item) => pathname.startsWith(item.href));

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

      {/* Телефон: фиксированная нижняя панель + выезжающий лист «Ещё» */}
      <div className="md:hidden">
        {open && (
          <>
            <button
              type="button"
              aria-label="Закрыть меню"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 bg-black/40"
            />
            <div className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] space-y-3 overflow-y-auto rounded-t-2xl border-t border-line bg-bg p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
              {profile}
              {links}
            </div>
          </>
        )}

        <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
          {primaryItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors ${
                  isActive ? "text-primary" : "text-muted"
                }`}
              >
                <span className="max-w-full truncate px-1">{item.short ?? item.label}</span>
                {item.badge ? (
                  <span className="absolute right-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors ${
              moreActive || open ? "text-primary" : "text-muted"
            }`}
          >
            <span aria-hidden className="text-base leading-none">
              ☰
            </span>
            Ещё
          </button>
        </nav>
      </div>
    </aside>
  );
}
