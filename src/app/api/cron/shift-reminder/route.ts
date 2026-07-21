import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { vnToday } from "@/lib/dates";
import { sendShiftReminder } from "@/lib/telegram";

// Крон напоминалок про смену (пак C). Vercel зовёт этот путь дважды в сутки:
// утром ?type=open, вечером ?type=close (см. vercel.json). Шлём напоминалку в
// группу инструкторов, только если сегодня реально есть кому её адресовать —
// иначе в дни без выходов группа получала бы ежедневный спам.
//
// /api не проходит через middleware, сессии тут нет — работаем service_role
// клиентом и защищаемся секретом (Vercel сам шлёт Authorization: Bearer
// <CRON_SECRET>, если переменная задана).

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // секрет ещё не задан — не блокируем (dev/до настройки)
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type") === "open" ? "open" : "close";
  const today = vnToday();
  const supabase = createAdminClient();

  // Есть ли кому напоминать?
  //  open  — запланированная смена, которую ещё не открыли;
  //  close — открытая смена, которую ещё не закрыли.
  let query = supabase
    .from("shifts")
    .select("id", { count: "exact", head: true })
    .eq("date", today);
  query =
    type === "open"
      ? query.eq("planned", true).is("opened_at", null)
      : query.not("opened_at", "is", null).is("closed_at", null);

  const { count, error } = await query;
  if (error) {
    console.error("[cron shift-reminder] count error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!count || count === 0) {
    return NextResponse.json({ type, sent: false, reason: "nothing to remind" });
  }

  await sendShiftReminder(type);
  return NextResponse.json({ type, sent: true, shifts: count });
}
