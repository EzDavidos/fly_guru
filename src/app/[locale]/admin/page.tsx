import type { Metadata } from "next";
import { Container, Section, SectionHeading } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { logoutAction } from "../login/actions";

export const metadata: Metadata = { title: "Админка" };

// Заглушка. Полная админка (заявки, сессии, дашборд, расчёты) — Этап 4.
export default async function AdminPage() {
  const user = await requireRole("admin", "/admin");

  return (
    <Section className="pt-10 sm:pt-14">
      <Container>
        <SectionHeading
          eyebrow={`Админ · ${user.name}`}
          title="Админка в разработке"
          subtitle="Заявки, сессии, дашборд и месячные расчёты появятся на Этапе 4. Кабинет инструктора уже работает: /instructor."
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
