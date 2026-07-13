"use client";

import { Link, usePathname } from "@/i18n/navigation";

// Шапка кабинета. На подстраницах — ссылка «назад» на домашний экран роли
// (инструктору — /instructor, админу — /admin), на самом домашнем экране
// не показываем ничего: там своя карточка профиля.
export function CabinetHeader({
  home,
  label,
}: {
  home: string;
  label: string;
}) {
  const pathname = usePathname();
  if (pathname === home) return null;

  return (
    <Link
      href={home}
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
    >
      <span aria-hidden>←</span> {label}
    </Link>
  );
}
