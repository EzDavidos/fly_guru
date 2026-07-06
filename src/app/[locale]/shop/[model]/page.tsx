import { Container, Section, SectionHeading } from "@/components/ui";

// Заглушка карточки фойла. Наполнение — Этап 6.
export default async function ShopModelPage({
  params,
}: {
  params: Promise<{ model: string }>;
}) {
  const { model } = await params;
  return (
    <Section className="pt-10 sm:pt-14">
      <Container>
        <SectionHeading eyebrow="Магазин" title={`Модель: ${model}`} subtitle="Карточка товара появится на Этапе 6." />
      </Container>
    </Section>
  );
}
