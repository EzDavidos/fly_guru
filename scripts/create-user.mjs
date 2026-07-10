#!/usr/bin/env node
// ============================================================================
// Создание пользователя FlyGuru (auth-аккаунт + строка в users).
//
// Использование (из корня проекта):
//   node scripts/create-user.mjs --role admin --name "Денис" \
//     --email denis@example.com --password "секрет"
//
//   node scripts/create-user.mjs --role instructor --name "Иван" \
//     --phone "+84 90 123 4567" --password "секрет"
//
// Если email не указан, генерится технический из телефона
// (например 84901234567@phone.flyguru.local) — вход тогда по телефону.
// Роль пишется в app_metadata JWT (быстрые проверки в middleware)
// и в users.role (источник правды).
//
// Ключи берутся из .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
// ============================================================================

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";

// ── Читаем .env.local (простой парсер: KEY=VALUE построчно) ──
function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // нет файла — рассчитываем на переменные окружения
  }
}
loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Нет NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (см. .env.local).");
  process.exit(1);
}

// ── Аргументы ──
const { values: args } = parseArgs({
  options: {
    role: { type: "string" },
    name: { type: "string" },
    email: { type: "string" },
    phone: { type: "string" },
    password: { type: "string" },
  },
});

const ROLES = ["admin", "instructor", "member", "agent"];
if (!args.role || !ROLES.includes(args.role) || !args.name || !args.password) {
  console.error(
    "Обязательно: --role (admin|instructor|member|agent), --name, --password.\n" +
      "И хотя бы одно из: --email, --phone.",
  );
  process.exit(1);
}

const phoneDigits = (args.phone ?? "").replace(/\D/g, "");
const email =
  args.email ?? (phoneDigits ? `${phoneDigits}@phone.flyguru.local` : null);
if (!email) {
  console.error("Укажите --email или --phone (из телефона сгенерится технический email).");
  process.exit(1);
}

// ── Создаём ──
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: created, error: authError } = await supabase.auth.admin.createUser({
  email,
  password: args.password,
  email_confirm: true, // подтверждение почты не нужно — аккаунты раздаём сами
  app_metadata: { role: args.role },
  user_metadata: { name: args.name },
});
if (authError) {
  console.error("Ошибка auth:", authError.message);
  process.exit(1);
}

const { error: dbError } = await supabase.from("users").insert({
  role: args.role,
  name: args.name,
  phone: phoneDigits || null,
  email,
  auth_id: created.user.id,
});
if (dbError) {
  console.error("Auth-аккаунт создан, но запись в users не удалась:", dbError.message);
  console.error("Удалите пользователя в Supabase-дашборде и попробуйте снова.");
  process.exit(1);
}

console.log(`✅ ${args.role} «${args.name}» создан.`);
console.log(`   Логин: ${args.phone ? `${args.phone} или ${email}` : email}`);
console.log(`   Пароль: ${args.password}`);
console.log(`   Вход: /login`);
