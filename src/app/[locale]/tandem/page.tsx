import type { Metadata } from "next";
import { Container, Section, SectionHeading, Card, Button } from "@/components/ui";
import { Media } from "@/components/Media";
import { getService, formatVnd, formatDuration } from "@/content/services";

export const metadata: Metadata = { title: "Тандем" };
export const dynamic = "force-static"; // статичная страница, форсим SSG

export default function TandemPage() {
  const options = [
    getService("tandem-adult"),
    getService("tandem-kid"),
  ];

  return (
    <>
      <Section className="pt-10 sm:pt-14">
        <Container>
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
                Тандем с инструктором
              </p>
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                Попробуйте полёт за 5 минут
              </h1>
              <p className="mt-4 max-w-lg text-lg text-muted">
                Самый простой способ понять, что такое электрофойл. Вы садитесь на доску
                вместе с инструктором и уже через минуту летите над водой — без подготовки
                и обязательств.
              </p>
              <div className="mt-8">
                <Button href="#form" size="lg">Записаться на тандем</Button>
              </div>
            </div>
            {/* TODO: фото/видео тандемного полёта */}
            <Media ratio="4/3" priority sizes="(min-width: 768px) 50vw, 100vw" />
          </div>
        </Container>
      </Section>

      <Section tone="muted">
        <Container>
          <SectionHeading eyebrow="Цены" title="5 минут полёта" />
          <div className="mt-10 grid gap-6 sm:grid-cols-2 md:max-w-2xl">
            {options.map((s) => (
              <Card key={s.id}>
                <h3 className="text-lg font-bold">{s.name}</h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-primary">{formatVnd(s.price)}</span>
                  <span className="text-sm text-muted">/ {formatDuration(s)}</span>
                </div>
                <div className="mt-6">
                  <Button href="#form" variant="secondary" className="w-full">Записаться</Button>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-sm text-muted">
            Тандем — это проба, он не даёт членства в клубе. Готовы двигаться дальше?{" "}
            <Button href="/training" variant="ghost">Перейти к обучению</Button>
          </p>
        </Container>
      </Section>

      {/* Секция под форму записи — форма появится на этапе 2 */}
      <Section id="form">
        <Container>
          <div className="mx-auto max-w-2xl rounded-3xl border border-dashed border-primary/40 bg-surface p-8 text-center sm:p-10">
            <h2 className="text-2xl font-bold">Запись на тандем</h2>
            <p className="mt-3 text-muted">
              {/* TODO (этап 2): форма записи */}
              Форма записи появится здесь на следующем этапе. Пока свяжитесь с нами напрямую —
              контакты в подвале сайта.
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
