import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Запись факта перехода по реф-ссылке /r/[code].
// Страница лендинга при открытии тихо стучится сюда, а мы сохраняем строку в
// таблицу ref_visits (какой код и с какого браузера). Это только статистика
// посещений — на заявки и на всё остальное никак не влияет.

interface Payload {
  code?: string;
}

export async function POST(req: NextRequest) {
  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const code = body.code?.trim();
  if (!code) return NextResponse.json({ ok: false }, { status: 400 });

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ref_visits")
    .insert({ code, user_agent: userAgent });

  if (error) {
    console.error("[ref-visits] insert error:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
