import { setRequestLocale } from "next-intl/server";
import { Container, Section, SectionHeading, Card, Badge, Button } from "@/components/ui";
import { Media } from "@/components/Media";
import { IconCheck } from "@/components/icons";
import { redirect } from "@/i18n/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveServices } from "@/lib/services";
import { getService } from "@/content/services";
import { BookingForm } from "@/components/BookingForm";
import { RefVisitLogger } from "@/components/RefVisitLogger";

// Реф-лендинг: гость приходит по личной ссылке агента или члена клуба /r/<код>.
// Отдельная страница (динамическая) — код проверяется в базе при каждом заходе,
// поэтому force-static здесь НЕ ставим.

// Проверка кода: есть ли активный агент с таким ref_code.
// (Реф-коды членов клуба появятся позже — Этап 5; здесь оставлен задел.)
async function isValidRefCode(code: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("agents")
    .select("id")
    .eq("ref_code", code)
    .eq("active", true)
    .maybeSingle();
  return Boolean(data);
}

export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);

  // Невалидный код (опечатка, устаревшая ссылка) — не показываем ошибку, а мягко
  // отправляем человека на обычную страницу обучения с обычной формой.
  if (!(await isValidRefCode(code))) {
    redirect({ href: "/training", locale });
  }

  // Услуги обучения для формы + предвыбор «взрослый базовый».
  const services = await getActiveServices("training");
  const defaultServiceId = services.find(
    (s) => s.name === getService("basic-adult").name,
  )?.id;

  return (
    <>
      {/* Невидимый помощник: запоминает код на 30 дней + пишет переход в статистику. */}
      <RefVisitLogger code={code} />

      {/* Герой */}
      <Section className="pt-10 sm:pt-14">
        <Container>
          <div className="grid items-center gap-10 md:grid-cols-12">
            <div className="md:col-span-7">
              <Badge>Приглашение по личной ссылке</Badge>
              <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">
                Полетите на электрофойле уже на первом занятии
              </h1>
              <p className="mt-4 max-w-lg text-lg text-muted">
                90% наших гостей встают на крыло и едут самостоятельно уже в первый раз.
                По этой ссылке — специальная скидка на базовое занятие.
              </p>
              <div className="mt-8">
                <Button href="#form" size="lg">Записаться со скидкой</Button>
              </div>
            </div>
            <Media
              src="/media/photo/ref-hero.webp"
              alt="Довольный гость FlyGuru на электрофойле"
              ratio="9/16"
              priority
              className="mx-auto max-w-[340px] md:col-span-5"
              sizes="340px"
            />
          </div>
        </Container>
      </Section>

      {/* Почему получится с первого раза */}
      <Section tone="muted">
        <Container>
          <SectionHeading eyebrow="Почему это легко" title="С нами получается сразу" />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                title: "Комфортные доски",
                text: "Устойчивые доски для новичков — на них проще поймать баланс и встать на крыло.",
              },
              {
                title: "Инструктор рядом на воде",
                text: "Инструктор держит связь с вами прямо во время катания и подсказывает каждое движение.",
              },
              {
                title: "Опытные инструкторы",
                text: "Учим с нуля сотни гостей — знаем, как быстро и безопасно поставить вас на фойл.",
              },
            ].map((item) => (
              <Card key={item.title}>
                <div className="mb-3">
                  <IconCheck className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm text-muted">{item.text}</p>
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* Блок скидки */}
      <Section>
        <Container>
          <div className="mx-auto max-w-2xl rounded-3xl border border-accent/30 bg-accent/5 p-8 text-center sm:p-10">
            <Badge>Скидка по ссылке</Badge>
            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">Базовое занятие дешевле на 200 000 ₫</h2>
            <div className="mt-6 flex items-baseline justify-center gap-3">
              <span className="text-xl text-muted line-through">2 000 000 ₫</span>
              <span className="text-4xl font-bold text-accent-strong">1 800 000 ₫</span>
            </div>
            <p className="mt-3 text-sm text-muted">
              Скидка применяется к базовому занятию (взрослый). Действует по этой ссылке.
            </p>
            <div className="mt-8">
              <Button href="#form" size="lg">Записаться</Button>
            </div>
          </div>
        </Container>
      </Section>

      {/* Форма записи с вшитым реф-кодом */}
      <Section id="form" tone="muted">
        <Container>
          <div className="mx-auto max-w-2xl rounded-3xl border border-line bg-surface p-8 sm:p-10">
            <h2 className="text-2xl font-bold">Запись со скидкой</h2>
            <p className="mt-3 text-muted">
              Оставьте контакт — свяжемся, подтвердим время и скидку.
            </p>
            <div className="mt-8">
              <BookingForm services={services} defaultServiceId={defaultServiceId} refCode={code} />
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
