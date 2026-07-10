"use client";

import { Link, usePathname } from "@/i18n/navigation";

// Нижняя навигация кабинета — как таб-бар в мобильном приложении.
// Сценарий: инструктор на пляже с телефоном, кнопки должны быть крупными.

const TABS = [
  { href: "/instructor", label: "Заявки" },
  { href: "/instructor/record", label: "Записать" },
  { href: "/instructor/subscription", label: "Абонемент" },
  { href: "/instructor/writeoff", label: "Списание" },
  { href: "/instructor/stats", label: "Статистика" },
] as const;

export function InstructorNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map((tab) => {
          const active =
            tab.href === "/instructor"
              ? pathname === "/instructor"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-1 py-3 text-[11px] font-semibold ${
                active ? "text-primary" : "text-muted"
              }`}
            >
              <span
                className={`h-1 w-6 rounded-full ${active ? "bg-primary" : "bg-transparent"}`}
              />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
