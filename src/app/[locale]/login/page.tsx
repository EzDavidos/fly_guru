import type { Metadata } from "next";
import { Container, Section, SectionHeading } from "@/components/ui";

export const metadata: Metadata = { title: "Вход" };
export const dynamic = "force-static"; // статичная страница, форсим SSG

// Заглушка. Вход для всех ролей — Этап 3.
export default function LoginPage() {
  return (
    <Section className="pt-10 sm:pt-14">
      <Container>
        <SectionHeading eyebrow="Кабинет" title="Вход" subtitle="Авторизация появится на Этапе 3." />
      </Container>
    </Section>
  );
}
