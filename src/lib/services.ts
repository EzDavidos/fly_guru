import { createAdminClient } from "@/lib/supabase/admin";
import type { ServiceOption } from "@/components/BookingForm";
import type { ServiceCategory } from "@/content/services";

// «Достать список активных услуг из базы» для выпадающего списка в форме.
//
// Зачем из базы, а не из файла services.ts: в базе у каждой услуги свой
// настоящий id (uuid), и именно его форма должна отправить в заявку (там связь
// по id). Названия в файле те же, но id — только в базе.
//
// category (необязательно) — показать услуги только одной категории
// (например, на странице обучения — только training).
export async function getActiveServices(
  category?: ServiceCategory,
): Promise<ServiceOption[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("services")
    .select("id, name, category")
    .eq("active", true)
    .order("price", { ascending: true, nullsFirst: false });

  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) {
    console.error("[services] load error:", error.message);
    return [];
  }
  return (data ?? []).map((s) => ({ id: s.id, name: s.name }));
}
