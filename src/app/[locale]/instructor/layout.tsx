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
  const user = await requireRole("instructor", "/instructor");

  // Админ попадает сюда на общие страницы (например, настройки) — стрелка
  // «назад» должна вести его в админку, а не в инструкторский кабинет.
  const home = user.role === "admin" ? "/admin" : "/instructor";

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
      <CabinetHeader home={home} label={user.role === "admin" ? "Админка" : "Кабинет"} />
      {children}
    </div>
  );
}
