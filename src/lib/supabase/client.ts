import { createBrowserClient } from "@supabase/ssr";

// Клиент для использования в браузерных (клиентских) компонентах.
// Использует публичные ключи (NEXT_PUBLIC_*), безопасен для фронтенда.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
