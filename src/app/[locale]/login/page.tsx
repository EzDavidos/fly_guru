import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container, Section } from "@/components/ui";
import { getAppUser, ROLE_HOME } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Вход" };

// Единый вход для всех ролей. После входа каждый попадает в свой кабинет
// (или обратно на страницу, с которой его выбросило, — параметр ?next=).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // Уже залогинен — незачем показывать форму.
  const user = await getAppUser();
  if (user) redirect(ROLE_HOME[user.role]);

  return (
    <Section className="pt-10 sm:pt-14">
      <Container>
        <div className="mx-auto max-w-sm">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">
            Кабинет
          </p>
          <h1 className="text-3xl font-bold">Вход</h1>
          <p className="mt-2 text-sm text-muted">
            Для инструкторов, членов клуба и агентов. Нет аккаунта? Его создаёт
            администратор — напишите нам.
          </p>
          <div className="mt-8">
            <LoginForm next={next} />
          </div>
        </div>
      </Container>
    </Section>
  );
}
