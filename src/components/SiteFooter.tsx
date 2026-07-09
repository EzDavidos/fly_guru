import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { NAV_LINKS } from "./nav";
import { IconPhone, IconChat, IconPin } from "./icons";
import { contacts, socials } from "@/content/contacts";

// Футер: навигация + контакты/соцсети/мессенджеры.
// Данные — из src/content/contacts.ts.
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        {/* Бренд */}
        <div>
          <div className="flex items-center gap-2 font-bold">
            <Image src="/brand/flyguru-logo.jpg" alt="FlyGuru" width={40} height={40} className="rounded-full" />
            <span className="text-lg">FlyGuru</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted">
            Школа электрофойлов в Нячанге. Полёт над водой с первого занятия.
          </p>
        </div>

        {/* Навигация */}
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Разделы</h3>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-muted hover:text-ink">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Контакты */}
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Контакты</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li className="flex items-center gap-2">
              <IconPhone className="h-5 w-5 shrink-0 text-primary" />
              <a href={contacts.phone.tel} className="hover:text-ink">
                {contacts.phone.display}
              </a>
            </li>
            <li className="flex items-center gap-2">
              <IconChat className="h-5 w-5 shrink-0 text-primary" />
              <span>
                <a href={contacts.phone.whatsapp} className="hover:text-ink">WhatsApp</a>
                {" · "}
                <a href={contacts.telegram} className="hover:text-ink">Telegram</a>
                {" · "}
                <a href={contacts.zalo} className="hover:text-ink">Zalo</a>
              </span>
            </li>
            <li className="flex items-center gap-2">
              <IconPin className="h-5 w-5 shrink-0 text-primary" />
              <a href={contacts.mapLink} target="_blank" rel="noopener noreferrer" className="hover:text-ink">
                {contacts.address}
              </a>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary-strong"
              >
                {s.name}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-line py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} FlyGuru. Все права защищены.
      </div>
    </footer>
  );
}
