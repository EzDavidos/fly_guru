import type { Metadata } from "next";
import { Container, Section, SectionHeading, Card, Button, Badge } from "@/components/ui";
import { Media, VideoPlayer } from "@/components/Media";
import { Faq } from "@/components/Faq";
import { IconCheck } from "@/components/icons";
import { getService, formatVnd, formatDuration } from "@/content/services";
import { trainingFaq } from "@/content/faq";
import { BookingForm } from "@/components/BookingForm";
import { getActiveServices } from "@/lib/services";

export const metadata: Metadata = { title: "Обучение" };
export const dynamic = "force-static"; // статичная страница, форсим SSG

export default async function TrainingPage() {
  // Услуги обучения из базы (с настоящими id) — для выпадающего списка в форме.
  const services = await getActiveServices("training");
  // Заранее выбираем «взрослый базовый» — самый популярный вариант.
  const defaultServiceId = services.find(
    (s) => s.name === getService("basic-adult").name,
  )?.id;

  const options = [
    { s: getService("basic-adult"), highlight: true, desc: "Индивидуальное занятие для взрослого с нуля." },
    { s: getService("basic-kid"), highlight: false, desc: "Отдельная программа для детей до 14 лет." },
    { s: getService("basic-duo"), highlight: false, desc: "Учитесь вдвоём — по очереди на одной доске." },
  ];

  return (
    <>
      <Section className="pt-10 sm:pt-14">
        <Container>
          <div className="grid items-center gap-10 md:grid-cols-12">
            <div className="md:col-span-5">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
                Базовое обучение
              </p>
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                Научитесь летать на электрофойле
              </h1>
              <p className="mt-4 max-w-lg text-lg text-muted">
                Занятие длится 60 минут. 90% учеников встают на крыло уже на первом занятии,
                до уверенного самостоятельного катания обычно 3–5 занятий.
              </p>
              <div className="mt-8">
                <Button href="#form" size="lg">Записаться на обучение</Button>
              </div>
            </div>
            <Media
              src="/media/photo/training-hero.webp"
              alt="Ученик на электрофойле рядом с инструктором"
              ratio="16/9"
              className="md:col-span-7"
              priority
              sizes="(min-width: 768px) 58vw, 100vw"
            />
          </div>
        </Container>
      </Section>

      {/* Три варианта обучения */}
      <Section tone="muted">
        <Container>
          <SectionHeading eyebrow="Форматы" title="Выберите вариант" />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {options.map(({ s, highlight, desc }) => (
              <Card key={s.id} className={highlight ? "ring-2 ring-primary" : ""}>
                {highlight && (
                  <div className="mb-3">
                    <Badge>Популярное</Badge>
                  </div>
                )}
                <h3 className="text-lg font-bold">{s.name}</h3>
                <p className="mt-2 text-sm text-muted">{desc}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-primary">{formatVnd(s.price)}</span>
                  <span className="text-sm text-muted">/ {formatDuration(s)}</span>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-muted">
                  <li className="flex gap-2">
                    <IconCheck className="h-5 w-5 shrink-0 text-primary" /> Всё снаряжение включено
                  </li>
                  <li className="flex gap-2">
                    <IconCheck className="h-5 w-5 shrink-0 text-primary" /> Инструктор рядом на воде
                  </li>
                  <li className="flex gap-2">
                    <IconCheck className="h-5 w-5 shrink-0 text-primary" /> Комфортные доски для новичков
                  </li>
                </ul>
                <div className="mt-6">
                  <Button href="#form" variant="secondary" className="w-full">Записаться</Button>
                </div>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* Как проходит занятие */}
      <Section>
        <Container>
          <div className="grid items-center gap-10 md:grid-cols-12">
            <div className="md:col-span-7">
              <SectionHeading eyebrow="Как это выглядит" title="Занятие изнутри" />
              <p className="mt-4 text-muted">
                Короткий инструктаж на берегу, затем сразу вода. Инструктор идёт рядом
                и держит с вами связь через наушник в шлеме — подсказывает каждое движение.
              </p>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <Media
                  src="/media/photo/training-uchenik.webp"
                  alt="Ученик самостоятельно едет на электрофойле"
                  ratio="16/9"
                  sizes="(min-width: 768px) 29vw, 50vw"
                />
                <Media
                  src="/media/photo/training-master.webp"
                  alt="Продвинутый курс: уверенное катание на электрофойле"
                  ratio="16/9"
                  sizes="(min-width: 768px) 29vw, 50vw"
                />
              </div>
            </div>
            {/* Ролик снят вертикально — показываем в родных 9:16, ограничив ширину. */}
            <VideoPlayer
              src="/media/video/obuchenie.mp4"
              poster="/media/video/obuchenie-poster.jpg"
              ratio="9/16"
              className="mx-auto max-w-[320px] md:col-span-5"
            />
          </div>
        </Container>
      </Section>

      {/* Сжатый FAQ */}
      <Section tone="muted">
        <Container>
          <SectionHeading eyebrow="Частые вопросы" title="Перед первым занятием" />
          <div className="mt-8 max-w-3xl">
            <Faq items={trainingFaq} />
          </div>
        </Container>
      </Section>

      {/* Форма записи на обучение */}
      <Section id="form">
        <Container>
          <div className="mx-auto max-w-2xl rounded-3xl border border-line bg-surface p-8 sm:p-10">
            <h2 className="text-2xl font-bold">Запись на обучение</h2>
            <p className="mt-3 text-muted">
              Оставьте контакт — свяжемся, подтвердим время и ответим на вопросы.
            </p>
            <div className="mt-8">
              <BookingForm services={services} defaultServiceId={defaultServiceId} />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
