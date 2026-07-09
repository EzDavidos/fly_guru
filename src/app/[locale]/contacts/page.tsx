import type { Metadata } from "next";
import { Container, Section, SectionHeading, Card } from "@/components/ui";
import { IconPhone, IconChat, IconPin } from "@/components/icons";
import { contacts, socials } from "@/content/contacts";

export const metadata: Metadata = { title: "Контакты" };
export const dynamic = "force-static"; // статичная страница, форсим SSG

export default function ContactsPage() {
  return (
    <Section className="pt-10 sm:pt-14">
      <Container>
        <SectionHeading eyebrow="Контакты" title="Как с нами связаться" subtitle="Пишите в мессенджер — отвечаем быстро." />

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <Card>
            <IconPhone className="h-7 w-7 text-primary" />
            <h3 className="mt-3 font-bold">Телефон / WhatsApp</h3>
            <p className="mt-1">
              <a href={contacts.phone.tel} className="text-muted hover:text-ink">
                {contacts.phone.display}
              </a>
            </p>
            <p className="mt-2 text-sm text-muted">{contacts.hours}</p>
          </Card>

          <Card>
            <IconChat className="h-7 w-7 text-primary" />
            <h3 className="mt-3 font-bold">Мессенджеры</h3>
            <div className="mt-1 flex flex-col gap-1 text-muted">
              <a href={contacts.phone.whatsapp} className="hover:text-ink">WhatsApp</a>
              <a href={contacts.telegram} className="hover:text-ink">Telegram</a>
              <a href={contacts.zalo} className="hover:text-ink">Zalo</a>
              <a href={`mailto:${contacts.email}`} className="hover:text-ink">{contacts.email}</a>
            </div>
          </Card>

          <Card>
            <IconPin className="h-7 w-7 text-primary" />
            <h3 className="mt-3 font-bold">Где нас найти</h3>
            <p className="mt-1 text-muted">{contacts.address}</p>
            <a
              href={contacts.mapLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-semibold text-primary hover:text-primary-strong"
            >
              Открыть в Google Maps
            </a>
          </Card>
        </div>

        {/* Соцсети */}
        <div className="mt-8 flex flex-wrap gap-4 text-sm">
          {socials.map((s) => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:text-primary-strong"
            >
              {s.name}
            </a>
          ))}
        </div>

        {/* Карта */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-line">
          <iframe
            title="FlyGuru на карте — Maryna Beach Club, Нячанг"
            src={contacts.mapEmbed}
            className="h-[320px] w-full sm:h-[420px]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </Container>
    </Section>
  );
}
