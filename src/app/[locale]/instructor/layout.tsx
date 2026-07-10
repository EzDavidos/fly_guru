import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { CabinetHeader } from "./CabinetHeader";

export const metadata: Metadata = { title: "Кабинет инструктора" };

// Кабинет инструктора: mobile-first, узкая колонка. Навигация — крупные кнопки
// на главном экране, на подстраницах ссылка «← Кабинет» (CabinetHeader).
// Доступ уже проверил middleware (быстрый рубеж), здесь — второй рубеж
// с чтением роли из БД, третий — RLS в самой базе.
export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole("instructor", "/instructor");

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
      <CabinetHeader />
      {children}
    </div>
  );
}
