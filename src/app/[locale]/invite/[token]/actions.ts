"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { phoneDigits } from "@/lib/phone";
import type { ActionState } from "../../instructor/actions";

// Приём приглашения: гость по одноразовой ссылке ставит пароль — появляется
// auth-аккаунт + строка в users (role=member), membership привязывается к
// аккаунту, токен гасится. Страница анонимная, поэтому всё через service_role
// (RLS не пустит незалогиненного) — но КАЖДЫЙ шаг заново проверяет токен.

export async function acceptInviteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = createAdminClient();

  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("password2") ?? "");
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();

  if (password.length < 6) return { error: "Пароль — минимум 6 символов." };
  if (password !== password2) return { error: "Пароли не совпадают." };
  if (emailRaw && !emailRaw.includes("@")) return { error: "Email выглядит неправильно." };

  // Токен проверяем на сервере ещё раз: страница могла висеть открытой,
  // пока ссылка истекла или её уже использовали.
  const { data: invite } = await admin
    .from("invite_tokens")
    .select("id, client_id, used_at, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!invite || invite.used_at || invite.expires_at < new Date().toISOString()) {
    return { error: "Ссылка больше не действует. Попросите новую у администратора." };
  }

  const { data: client } = await admin
    .from("clients")
    .select("id, name, phone")
    .eq("id", invite.client_id)
    .maybeSingle();
  if (!client) return { error: "Клиент не найден. Напишите администратору." };

  const { data: membership } = await admin
    .from("memberships")
    .select("id, user_id")
    .eq("client_id", client.id)
    .maybeSingle();
  if (!membership) return { error: "Членство не найдено. Напишите администратору." };
  if (membership.user_id) {
    return { error: "Аккаунт уже создан — войдите на странице входа." };
  }

  // Логин у нас по email; без настоящего email вход идёт по телефону через
  // технический адрес <цифры>@phone.flyguru.local (как в scripts/create-user.mjs).
  const digits = phoneDigits(client.phone ?? "");
  const email = emailRaw || (digits ? `${digits}@phone.flyguru.local` : null);
  if (!email) return { error: "У вас не записан телефон — укажите email." };

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "member" },
    user_metadata: { name: client.name },
  });
  if (authError || !created.user) {
    return {
      error: emailRaw
        ? "Не получилось создать аккаунт: возможно, этот email уже занят."
        : "Не получилось создать аккаунт. Напишите администратору.",
    };
  }

  // users + привязка membership + гашение токена. Если середина цепочки
  // упала — убираем auth-аккаунт, чтобы можно было пройти по ссылке заново.
  const { data: appUser, error: userError } = await admin
    .from("users")
    .insert({
      role: "member",
      name: client.name,
      phone: digits || null,
      email,
      auth_id: created.user.id,
    })
    .select("id")
    .single();
  if (userError || !appUser) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "Не получилось создать аккаунт. Напишите администратору." };
  }

  await admin
    .from("memberships")
    .update({ user_id: appUser.id })
    .eq("id", membership.id);
  await admin
    .from("invite_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", invite.id);

  // Сразу логиним (обычный клиент — куки сессии уходят в браузер) и в кабинет.
  const supabase = await createClient();
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (loginError) redirect("/login");
  redirect("/member");
}
