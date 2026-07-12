import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Container, Section, Badge } from "@/components/ui";
import { createAdminClient } from "@/lib/supabase/admin";
import { phoneDigits } from "@/lib/phone";
import { InviteForm } from "./InviteForm";

export const metadata: Metadata = { title: "Приглашение в клуб FlyGuru" };

// Приглашение в кабинет члена клуба: одноразовая ссылка /invite/<token>,
// которую админ отправляет клиенту в мессенджер. Страница анонимная и
// динамическая — токен проверяется в базе при каждом заходе (service_role,
// как у реф-лендинга /r/[code]).

// Понятное объяснение вместо формы, когда ссылка не сработала.
function InviteDead({ title, text }: { title: string; text: string }) {
  return (
    <Section className="pt-10 sm:pt-14">
      <Container>
        <div className="mx-auto max-w-md rounded-3xl border border-line bg-surface p-8 text-center">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-3 text-sm text-muted">{text}</p>
        </div>
      </Container>
    </Section>
  );
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invite_tokens")
    .select("client_id, used_at, expires_at, client:clients!client_id(name, phone)")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return (
      <InviteDead
        title="Ссылка не работает"
        text="Проверьте, что скопировали её целиком, или попросите новую у администратора."
      />
    );
  }
  if (invite.used_at) {
    return (
      <InviteDead
        title="Ссылка уже использована"
        text="Аккаунт по этому приглашению создан. Войдите на странице входа — по телефону или email."
      />
    );
  }
  if (invite.expires_at < new Date().toISOString()) {
    return (
      <InviteDead
        title="Срок ссылки истёк"
        text="Приглашение действует 7 дней. Попросите у администратора новую ссылку."
      />
    );
  }

  const client = invite.client as unknown as { name: string; phone: string | null } | null;
  const digits = phoneDigits(client?.phone ?? "");

  return (
    <Section className="pt-10 sm:pt-14">
      <Container>
        <div className="mx-auto max-w-md rounded-3xl border border-line bg-surface p-8">
          <Badge>Клуб FlyGuru</Badge>
          <h1 className="mt-4 text-2xl font-bold">
            {client?.name ? `${client.name}, добро пожаловать в клуб!` : "Добро пожаловать в клуб!"}
          </h1>
          <p className="mt-3 text-sm text-muted">
            Придумайте пароль — и получите личный кабинет: остаток минут,
            история каталок и ваша ссылка «приведи друга».
          </p>
          <div className="mt-6">
            <InviteForm token={token} phone={digits || null} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
