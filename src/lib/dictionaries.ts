import type { createClient } from "@/lib/supabase/server";

// Справочники, которые админ ведёт сам (пачка правок №4, пак A):
//  • expense_categories — категории расходов (аренда, топливо, инвентарь…);
//  • payment_methods — форматы оплаты (наличные, QR, T-Bank, перевод…).
//
// Оба устроены одинаково: имя + флаг active. Скрытая позиция (active=false)
// пропадает из выпадашек, но остаётся в старых записях — историю не переписываем.

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface DictItem {
  id: string;
  name: string;
  active: boolean;
}

export type DictTable = "expense_categories" | "payment_methods";

// Человеческие названия — для текстов ошибок и заголовков, чтобы не плодить
// строковые литералы по экшенам.
export const DICT_LABEL: Record<DictTable, string> = {
  expense_categories: "категория расхода",
  payment_methods: "формат оплаты",
};

// Только видимые позиции — для форм.
export async function getActiveDict(
  supabase: Supabase,
  table: DictTable,
): Promise<DictItem[]> {
  const { data, error } = await supabase
    .from(table)
    .select("id, name, active")
    .eq("active", true)
    .order("name");
  if (error) {
    console.error(`[dictionaries] ${table} load error:`, error.message);
    return [];
  }
  return (data ?? []) as DictItem[];
}

// Все позиции, включая скрытые — для экрана управления в настройках.
// Активные сверху: с ними работают каждый день, скрытые — архив внизу.
export async function getFullDict(
  supabase: Supabase,
  table: DictTable,
): Promise<DictItem[]> {
  const { data, error } = await supabase
    .from(table)
    .select("id, name, active")
    .order("active", { ascending: false })
    .order("name");
  if (error) {
    console.error(`[dictionaries] ${table} load error:`, error.message);
    return [];
  }
  return (data ?? []) as DictItem[];
}
