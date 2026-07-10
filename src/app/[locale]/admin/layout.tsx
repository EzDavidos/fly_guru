import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { CabinetHeader } from "./CabinetHeader";

export const metadata: Metadata = { title: "Админка" };

// Кабинет админа: тот же mobile-first формат, что у инструктора (узкая
// колонка, крупные кнопки на главном экране, «← Админка» на подстраницах).
// Доступ: middleware (быстрый рубеж) → requireRole (роль из БД) → RLS.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("admin", "/admin");

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
      <CabinetHeader />
      {children}
    </div>
  );
}
