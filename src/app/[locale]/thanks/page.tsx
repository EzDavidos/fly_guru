import type { Metadata } from "next";
import { Container, Section, Button } from "@/components/ui";

export const metadata: Metadata = { title: "Заявка принята" };
export const dynamic = "force-static"; // статичная страница, форсим SSG

// Страница «спасибо». Сюда форма перенаправляет человека после успешной отправки
// заявки. Задача — успокоить («мы получили заявку») и сказать, что будет дальше.
export default function ThanksPage() {
  return (
    <Section className="pt-16 sm:pt-24">
      <Container>
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
            ✅
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">Заявка принята!</h1>
          <p className="mt-4 text-lg text-muted">
            {/* TODO: подтвердить срок ответа (например, «в течение 2 часов») */}
            Спасибо! Мы получили вашу заявку и свяжемся с вами в ближайшее время,
            чтобы подтвердить детали и удобное время.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button href="/">На главную</Button>
            <Button href="/training" variant="secondary">
              Смотреть обучение
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
