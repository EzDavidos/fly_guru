import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Остаток минут абонемента (архитектура + этап 4):
//   total_minutes + сумма ручных корректировок − сумма списаний.
// Корректировки (subscription_adjustments) — правки админа/инструктора
// с обязательным комментарием; списания — сессии с этим subscription_id.
export async function minutesLeft(
  supabase: Supabase,
  sub: { id: string; total_minutes: number },
): Promise<number> {
  const [used, adj] = await Promise.all([
    supabase
      .from("sessions")
      .select("minutes_used")
      .eq("subscription_id", sub.id),
    supabase
      .from("subscription_adjustments")
      .select("delta_minutes")
      .eq("subscription_id", sub.id),
  ]);
  const usedSum = (used.data ?? []).reduce((s, r) => s + (r.minutes_used ?? 0), 0);
  const adjSum = (adj.data ?? []).reduce((s, r) => s + (r.delta_minutes ?? 0), 0);
  return sub.total_minutes + adjSum - usedSum;
}
