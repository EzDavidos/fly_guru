"use client";

import { Link, usePathname } from "@/i18n/navigation";

// Шапка кабинета. На подстраницах — ссылка «назад» на главный экран,
// на самом главном экране (/instructor) не показываем ничего:
// там своя карточка профиля.
export function CabinetHeader() {
  const pathname = usePathname();
  if (pathname === "/instructor") return null;

  return (
    <Link
      href="/instructor"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
    >
      <span aria-hidden>←</span> Кабинет
    </Link>
  );
}
