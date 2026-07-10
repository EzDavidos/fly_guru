import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { vnCurrentMonth } from "@/lib/dates";
import { getInstructorStats, vnd } from "@/lib/stats";
import { logoutAction } from "../login/actions";

// Главный экран кабинета: карточка профиля (фото + главные цифры месяца +
// цель по ЗП) и крупные кнопки-разделы. Сценарий — инструктор на пляже
// с телефоном, всё должно нажиматься большим пальцем.

// Красный кружочек-счётчик в углу кнопки «Записи».
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

export default async function InstructorHomePage() {
  const user = await getAppUser();
  if (!user) return null; // layout уже средиректил бы; страховка для типов

  const supabase = await createClient();
  const month = vnCurrentMonth();
  const stats = await getInstructorStats(supabase, user.id, month);

  // Активные записи: подтверждены админом, ещё никем не приняты.
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", "confirmed")
    .is("accepted_by", null);
  const activeCount = count ?? 0;

  const goal = Number(user.monthly_goal ?? 0);
  const progress = goal > 0 ? Math.min(100, (stats.salary / goal) * 100) : 0;

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
            <p className="text-2xl font-bold text-primary">{vnd(stats.salary)}</p>
            <p className="text-xs text-muted">
              ЗП за {month.label} · клиентов: {stats.clientsCount}
            </p>
          </div>
        </div>

        {goal > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Цель на месяц</span>
              <span>
                {vnd(stats.salary)} / {vnd(goal)}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-line/60">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Кнопки-разделы (порядок предварительный — поменять легко) */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          href="/instructor/record"
          className="col-span-2 flex min-h-20 items-center justify-center rounded-2xl bg-accent p-4 text-base font-bold text-white transition-colors hover:bg-accent-strong"
        >
          Записать клиента
        </Link>

        <Link href="/instructor/bookings" className={tileClass}>
          <CountBubble count={activeCount} />
          Записи
          <span className="text-xs font-normal text-muted">от админа</span>
        </Link>
        <Link href="/instructor/stats" className={tileClass}>
          Статистика
          <span className="text-xs font-normal text-muted">за любой период</span>
        </Link>

        <Link href="/instructor/subscription" className={tileClass}>
          Абонемент
          <span className="text-xs font-normal text-muted">продажа</span>
        </Link>
        <Link href="/instructor/writeoff" className={tileClass}>
          Списание
          <span className="text-xs font-normal text-muted">минуты</span>
        </Link>

        <Link href="/instructor/settings" className={tileClass}>
          Настройки
          <span className="text-xs font-normal text-muted">имя · фото · цель</span>
        </Link>
        <form action={logoutAction} className="contents">
          <button type="submit" className={`${tileClass} text-muted`}>
            Выход
          </button>
        </form>
      </div>
    </div>
  );
}
