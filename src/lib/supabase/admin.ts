import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// «Серверный ключ-мастер» к базе данных.
//
// Простыми словами: у нас в базе включена защита (RLS), которая запрещает
// анонимным посетителям читать и писать напрямую. Но серверу нужно уметь и
// записать заявку, и прочитать список услуг. Для этого есть особый ключ
// service_role — он обходит все запреты.
//
// ВАЖНО: этот ключ секретный. Он берётся из серверной переменной окружения
// (без префикса NEXT_PUBLIC_), поэтому в браузер он НИКОГДА не попадает.
// Использовать этот клиент только в серверном коде (API-роуты, серверные
// компоненты) — не в клиентских ('use client') файлах.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        // Серверу не нужна пользовательская сессия: он ходит как «сам сервер».
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
