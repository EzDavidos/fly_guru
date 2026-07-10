"use client";

import { Link, usePathname } from "@/i18n/navigation";

// Шапка админки: на подстраницах — ссылка «назад» на главный экран,
// на самом главном (/admin) не показываем ничего — там карточка профиля.
export function CabinetHeader() {
  const pathname = usePathname();
  if (pathname === "/admin") return null;

  return (
    <Link
      href="/admin"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
    >
      <span aria-hidden>←</span> Админка
    </Link>
  );
}
