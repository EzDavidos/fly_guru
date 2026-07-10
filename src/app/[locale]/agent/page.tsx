import type { Metadata } from "next";
import { Container, Section, SectionHeading } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { logoutAction } from "../login/actions";

export const metadata: Metadata = { title: "Кабинет агента" };

// Заглушка. Кабинет агента (реф-ссылка, статистика, комиссия) — Этап 5.
export default async function AgentPage() {
  const user = await requireRole("agent", "/agent");

  return (
    <Section className="pt-10 sm:pt-14">
      <Container>
        <SectionHeading
          eyebrow={`Агент · ${user.name}`}
          title="Кабинет в разработке"
          subtitle="Ваша реф-ссылка, статистика переходов и комиссия появятся здесь совсем скоро."
        />
        <form action={logoutAction} className="mt-6">
          <button
            type="submit"
            className="rounded-full border border-line px-5 py-2 text-sm font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
          >
            Выйти
          </button>
        </form>
      </Container>
    </Section>
  );
}
