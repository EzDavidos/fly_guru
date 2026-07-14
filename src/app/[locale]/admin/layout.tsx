import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { vnCurrentMonth } from "@/lib/dates";
import { vnd } from "@/lib/stats";
import { Sidebar } from "./Sidebar";

export const metadata: Metadata = { title: "Админка" };

// Кабинет админа: слева боковое меню (на ПК — колонка, на телефоне —
// разворачиваемая плашка), справа — контент активного раздела.
// Доступ: middleware (быстрый рубеж) → requireRole (роль из БД) → RLS.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("admin", "/admin");

  // Данные для карточки профиля в сайдбаре: выручка школы за месяц и число
  // новых заявок (красный счётчик). Раньше считались на главном экране —
  // теперь тут, чтобы жить в сайдбаре на всех разделах.
  const supabase = await createClient();
  const month = vnCurrentMonth();
  const [sessionsRes, paidSubsRes, freshRes] = await Promise.all([
    supabase
      .from("sessions")
      .select("amount")
      .gte("date", month.fromDay)
      .lt("date", month.toDay),
    supabase
      .from("subscriptions")
      .select("price")
      .gte("paid_at", month.fromIso)
      .lt("paid_at", month.toIso),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
  ]);

  const revenue =
    (sessionsRes.data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0) +
    (paidSubsRes.data ?? []).reduce((s, r) => s + (r.price ?? 0), 0);
  const freshCount = freshRes.count ?? 0;

  return (
    // На ПК — app-shell: область кабинета фиксированной высоты (вьюпорт минус
    // шапка ~4rem), сайдбар и контент скроллятся независимо (крутится та
    // колонка, над которой мышь; левый бар не уезжает). На телефоне — обычный
    // скролл страницы, меню сверху разворачивается.
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 md:h-[calc(100dvh-4rem)] md:py-0">
      <div className="md:flex md:h-full md:gap-6">
        <Sidebar
          name={user.name}
          photoUrl={user.photo_url}
          amountLabel={vnd(revenue)}
          amountSub={`Выручка за ${month.label} · только оплаченное`}
          freshCount={freshCount}
        />
        <main className="scroll-soft mt-4 min-w-0 md:mt-0 md:flex-1 md:overflow-y-auto md:overscroll-contain md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
