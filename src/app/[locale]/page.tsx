import { Container, Section, SectionHeading, Card, Button } from "@/components/ui";
import { Media } from "@/components/Media";
import { Faq } from "@/components/Faq";
import { ReviewCard } from "@/components/ReviewCard";
import { IconTandem, IconFoil, IconClub, IconArrowRight } from "@/components/icons";
import { homeFaq } from "@/content/faq";
import { reviews } from "@/content/reviews";

// Страница полностью статична — форсим SSG. В Next 16 классификация
// static/dynamic для страниц с next-intl Link нестабильна; директива это фиксирует.
export const dynamic = "force-static";

export default function HomePage() {
  const steps = [
    {
      icon: IconTandem,
      title: "1. Тандем",
      text: "Пробный полёт с инструктором за 5 минут. Без обязательств — просто попробовать, как это.",
    },
    {
      icon: IconFoil,
      title: "2. Базовое обучение",
      text: "Встаёшь на крыло. Обычно 3–5 занятий до самостоятельного катания.",
    },
    {
      icon: IconClub,
      title: "3. Абонемент и клуб",
      text: "Катайся сам по абонементу, езди на экскурсии, путешествия и сафари с клубом.",
    },
  ];

  return (
    <>
      {/* ── Hero ── */}
      <Section className="pt-10 sm:pt-16">
        <Container>
          <div className="grid items-center gap-10 md:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
                Электрофойл-школа в Нячанге
              </p>
              <h1 className="text-3xl font-bold leading-tight sm:text-5xl">
                Полёт над водой — уже с первого занятия
              </h1>
              <p className="mt-4 max-w-lg text-lg text-muted">
                90% учеников встают на крыло на первом же занятии. Комфортные доски,
                инструктор всё время рядом с вами на воде.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button href="/training#form" size="lg">
                  Записаться
                </Button>
                <Button href="/tandem" size="lg" variant="secondary">
                  Попробовать тандем
                </Button>
              </div>
            </div>
            {/* TODO: заменить на реальное фото/видео полёта над водой */}
            <Media ratio="4/3" priority sizes="(min-width: 768px) 50vw, 100vw" />
          </div>
        </Container>
      </Section>

      {/* ── Путь клиента ── */}
      <Section tone="muted">
        <Container>
          <SectionHeading
            eyebrow="Как это работает"
            title="Путь от первого полёта до клуба"
            align="center"
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map((s) => (
              <Card key={s.title}>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-muted">{s.text}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* ── FAQ (высоко на странице) ── */}
      <Section>
        <Container>
          <SectionHeading eyebrow="Частые вопросы" title="Коротко о главном" />
          <div className="mt-8">
            <Faq items={homeFaq} />
          </div>
        </Container>
      </Section>

      {/* ── Отзывы ── */}
      <Section tone="muted">
        <Container>
          <div className="flex items-end justify-between gap-4">
            <SectionHeading eyebrow="Отзывы" title="Что говорят ученики" />
            <Button href="/reviews" variant="ghost" className="hidden sm:inline-flex">
              Все отзывы <IconArrowRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {reviews.slice(0, 3).map((r, i) => (
              <ReviewCard key={i} review={r} />
            ))}
          </div>
          <div className="mt-6 sm:hidden">
            <Button href="/reviews" variant="secondary">
              Все отзывы <IconArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Container>
      </Section>

      {/* ── Тизер магазина ── */}
      <Section>
        <Container>
          <div className="grid items-center gap-8 rounded-3xl border border-line bg-surface p-8 sm:p-10 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">Продаём электрофойлы</h2>
              <p className="mt-3 text-muted">
                {/* TODO: перечислить бренды, которые продаёте */}
                Официально возим и продаём электрофойлы брендов [TODO: бренды].
                Поможем выбрать под ваш вес и уровень, расскажем про обслуживание.
              </p>
              <div className="mt-6">
                <Button href="/shop">Смотреть магазин</Button>
              </div>
            </div>
            {/* TODO: фото фойла на белом фоне */}
            <Media ratio="16/9" sizes="(min-width: 768px) 50vw, 100vw" />
          </div>
        </Container>
      </Section>
    </>
  );
}
