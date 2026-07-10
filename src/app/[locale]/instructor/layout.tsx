import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { logoutAction } from "../login/actions";
import { InstructorNav } from "./InstructorNav";

export const metadata: Metadata = { title: "Кабинет инструктора" };

// Кабинет инструктора: mobile-first, узкая колонка, таб-бар снизу.
// Доступ уже проверил middleware (быстрый рубеж), здесь — второй рубеж
// с чтением роли из БД, третий — RLS в самой базе.
export default async function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("instructor", "/instructor");

  return (
    <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Кабинет инструктора
          </p>
          <p className="text-sm text-muted">{user.name}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
          >
            Выйти
          </button>
        </form>
      </div>
      {children}
      <InstructorNav />
    </div>
  );
}
