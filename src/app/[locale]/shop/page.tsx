import type { Metadata } from "next";
import { Container, Section, SectionHeading } from "@/components/ui";

export const metadata: Metadata = { title: "Магазин" };
export const dynamic = "force-static"; // статичная страница, форсим SSG

// Заглушка. Каталог фойлов — Этап 6.
export default function ShopPage() {
  return (
    <Section className="pt-10 sm:pt-14">
      <Container>
        <SectionHeading
          eyebrow="Магазин"
          title="Электрофойлы в продаже"
          subtitle="Возим и продаём Hobbywing и Lift Foils. Каталог с ценами скоро появится — пока по вопросам покупки пишите нам в контактах."
        />
      </Container>
    </Section>
  );
}
