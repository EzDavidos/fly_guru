import type { Metadata } from "next";
import { Container, Section, SectionHeading, Card } from "@/components/ui";
import { IconPhone, IconChat, IconPin } from "@/components/icons";

export const metadata: Metadata = { title: "Контакты" };
export const dynamic = "force-static"; // статичная страница, форсим SSG

export default function ContactsPage() {
  return (
    <Section className="pt-10 sm:pt-14">
      <Container>
        <SectionHeading eyebrow="Контакты" title="Как с нами связаться" subtitle="Пишите в мессенджер — отвечаем быстро." />

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {/* TODO: телефон / WhatsApp */}
          <Card>
            <IconPhone className="h-7 w-7 text-primary" />
            <h3 className="mt-3 font-bold">Телефон / WhatsApp</h3>
            <p className="mt-1 text-muted">+84 XXX XXX XXX</p>
          </Card>
          {/* TODO: Telegram / основной мессенджер */}
          <Card>
            <IconChat className="h-7 w-7 text-primary" />
            <h3 className="mt-3 font-bold">Telegram</h3>
            <p className="mt-1 text-muted">@flyguru_todo</p>
          </Card>
          {/* TODO: адрес / место старта на воде */}
          <Card>
            <IconPin className="h-7 w-7 text-primary" />
            <h3 className="mt-3 font-bold">Где нас найти</h3>
            <p className="mt-1 text-muted">Нячанг, Вьетнам</p>
          </Card>
        </div>

        {/* Соцсети */}
        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          {/* TODO: реальные ссылки на соцсети */}
          <a href="#" className="font-semibold text-primary hover:text-primary-strong">Instagram</a>
          <a href="#" className="font-semibold text-primary hover:text-primary-strong">YouTube</a>
          <a href="#" className="font-semibold text-primary hover:text-primary-strong">TikTok</a>
        </div>

        {/* Карта */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-line">
          {/* TODO: заменить на точную точку старта (координаты) в Нячанге */}
          <iframe
            title="FlyGuru на карте — Нячанг"
            src="https://www.google.com/maps?q=Nha%20Trang%2C%20Vietnam&output=embed"
            className="h-[320px] w-full sm:h-[420px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </Container>
    </Section>
  );
}
