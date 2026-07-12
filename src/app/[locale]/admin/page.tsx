import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { vnCurrentMonth } from "@/lib/dates";
import { vnd } from "@/lib/stats";
import { logoutAction } from "../login/actions";

// Главный экран админки: карточка профиля (фото + выручка школы за месяц)
// и кнопки-разделы. Формат тот же, что у инструктора; разделы включаются
// по мере готовности подэтапов Этапа 4.

// Красный кружочек-счётчик в углу кнопки.
function CountBubble({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
      {count}
    </span>
  );
}

const tileClass =
  "relative flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-line bg-surface p-4 text-sm font-semibold transition-colors hover:border-primary";

// Раздел ещё не готов: серая плитка без ссылки, чтобы структура кабинета
// была видна сразу, а включение раздела не двигало кнопки местами.
function SoonTile({ label }: { label: string }) {
  return (
    <div className={`${tileClass} cursor-default opacity-45 hover:border-line`}>
      {label}
      <span className="text-xs font-normal text-muted">скоро</span>
    </div>
  );
}

export default async function AdminHomePage() {
  const user = await getAppUser();
  if (!user) return null; // layout уже средиректил бы; страховка для типов

  const supabase = await createClient();
  const month = vnCurrentMonth();

  // Три независимых запроса — параллельно (база в другом регионе, каждый
  // последовательный поход — лишние миллисекунды).
  const [sessionsRes, paidSubsRes, freshRes] = await Promise.all([
    // Выручка школы: чеки всех сессий за месяц…
    supabase
      .from("sessions")
      .select("amount")
      .gte("date", month.fromDay)
      .lt("date", month.toDay),
    // …плюс абонементы, ОПЛАЧЕННЫЕ в этом месяце (правило: доход существует
    // только после факта оплаты; месяц оплаты, не месяц продажи).
    supabase
      .from("subscriptions")
      .select("price")
      .gte("paid_at", month.fromIso)
      .lt("paid_at", month.toIso),
    // Новые заявки, ждущие реакции админа.
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
    <div>
      {/* Карточка профиля */}
      <div className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-4">
          {user.photo_url ? (
            <Image
              src={user.photo_url}
              alt={user.name}
              width={72}
              height={72}
              className="h-18 w-18 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
              {user.name.trim().charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-bold">{user.name}</p>
            <p className="text-2xl font-bold text-primary">{vnd(revenue)}</p>
            <p className="text-xs text-muted">
              Выручка за {month.label} · только оплаченное
            </p>
          </div>
        </div>
      </div>

      {/* Кнопки-разделы */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          href="/admin/bookings"
          className="relative col-span-2 flex min-h-20 items-center justify-center rounded-2xl bg-accent p-4 text-base font-bold text-white transition-colors hover:bg-accent-strong"
        >
          Актуальные заявки
          <CountBubble count={freshCount} />
        </Link>

        <Link href="/admin/sessions" className={tileClass}>
          Сессии
          <span className="text-xs font-normal text-muted">занятия · задним числом</span>
        </Link>
        <Link href="/admin/subscriptions" className={tileClass}>
          Абонементы
          <span className="text-xs font-normal text-muted">оплаты · минуты</span>
        </Link>

        <SoonTile label="Клиенты" />
        <SoonTile label="Агенты" />

        <SoonTile label="Члены клуба" />
        <SoonTile label="Материалы" />

        <SoonTile label="Дашборд" />
        <SoonTile label="Расчёт месяца" />

        <SoonTile label="Услуги" />
        <Link href="/instructor/settings" className={tileClass}>
          Настройки
          <span className="text-xs font-normal text-muted">имя · фото</span>
        </Link>

        <form action={logoutAction} className="col-span-2 contents">
          <button type="submit" className={`${tileClass} col-span-2 text-muted`}>
            Выход
          </button>
        </form>
      </div>
    </div>
  );
}
