import type { createClient } from "@/lib/supabase/server";

// Когда агент зарабатывает на приведённом клиенте (пачка правок №6, п.5).
//
// Правило школы, дословно от начальника: агенту платим ТОЛЬКО за то, что
// человек впервые сел на фойл у нас — то есть за первое базовое обучение
// (в том числе парное). Всё остальное — тандемы, прокат, экскурсии, повторные
// занятия того же гостя — агент уже не приводит, он их просто сопровождает.
//
// Раньше награда писалась при любом занятии с агентским кодом. Клиент,
// пришедший второй раз с тем же телефоном, начислял агенту ещё 300 000 ₫ —
// именно так у одного гостя оказалось две награды подряд.
//
// Скидка −10% живёт по тому же правилу: она даётся вместе с наградой, за
// первое базовое обучение. Второй раз по той же ссылке — уже без скидки.

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Скидка клиенту по агентской ссылке. */
export const REF_DISCOUNT_RATE = 0.1;

/**
 * Услуги, за которые агенту вообще может причитаться награда: базовое
 * обучение (взрослое, детское) и парное базовое. Индивидуальное обучающее
 * занятие сюда не входит — его берут те, кто уже катается.
 */
export const BASIC_TRAINING_CODES = ["basic-adult", "basic-kid", "basic-duo"];

export function isBasicTraining(code: string | null | undefined): boolean {
  return Boolean(code) && BASIC_TRAINING_CODES.includes(code as string);
}

/**
 * Катался ли клиент у нас на базовом обучении раньше. Смотрим уже записанные
 * сессии: если хоть одна базовая есть — это не первый раз, награда не
 * положена. Считаем ДО вставки новой сессии, иначе она найдёт саму себя.
 *
 * Ошибку запроса трактуем как «катался» — не начислить лишнего важнее, чем
 * не начислить положенное: пропущенную награду админ добавит руками, а лишние
 * деньги агенту уже уехали.
 */
export async function hasEarlierBasicTraining(
  supabase: Supabase,
  clientId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, services!inner(code)")
    .eq("client_id", clientId)
    .in("services.code", BASIC_TRAINING_CODES)
    .limit(1);
  if (error) {
    console.error("[agentReward] previous training check failed:", error.message);
    return true;
  }
  return (data ?? []).length > 0;
}

/**
 * Итог для одного оформления: положены ли агенту награда и комиссия, а
 * клиенту — скидка. Всё это одно и то же событие, поэтому и решение одно.
 */
export async function agentRewardApplies(
  supabase: Supabase,
  {
    hasAgent,
    serviceCode,
    clientId,
  }: { hasAgent: boolean; serviceCode: string | null | undefined; clientId: string },
): Promise<boolean> {
  if (!hasAgent || !isBasicTraining(serviceCode)) return false;
  return !(await hasEarlierBasicTraining(supabase, clientId));
}

/** Чек со скидкой, если она положена. */
export function applyRefDiscount(amount: number, discounted: boolean): number {
  if (!discounted) return amount;
  return Math.max(0, amount - Math.round(amount * REF_DISCOUNT_RATE));
}
