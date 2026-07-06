import { Container, Section, SectionHeading } from "@/components/ui";

// Заглушка реф-лендинга. Наполнение — Этап 2.
// [code] — реф-код из URL, позже зашивается в форму заявки (booking.ref_code).
export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <Section className="pt-10 sm:pt-14">
      <Container>
        <SectionHeading eyebrow="Приглашение" title="Скидка по реф-ссылке" subtitle={`Код: ${code}. Продающий лендинг и форма — Этап 2.`} />
      </Container>
    </Section>
  );
}
