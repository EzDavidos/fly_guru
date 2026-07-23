import type { Metadata } from "next";
import { Container, Section, SectionHeading, Card, Button, Badge } from "@/components/ui";
import { IconCheck, IconWaves, IconPin, IconClub } from "@/components/icons";
import { Media, VideoLoop } from "@/components/Media";
import { formatVnd, formatDuration } from "@/content/services";
import { getSiteServices, pickService } from "@/lib/services";

export const metadata: Metadata = { title: "Клуб" };
export const dynamic = "force-static"; // статичная страница, форсим SSG

export default async function ClubPage() {
  // Цены карточек — из базы (правятся в админке, /admin/services).
  const site = await getSiteServices();

  const sub = pickService(site, "subscription");
  const rental = pickService(site, "rental");

  // Аргумент выгоды считаем из данных, чтобы не разошлось с прайсом.
  const subPerMin = Math.round((sub.price as number) / (sub.durationMin as number)); // 20 000
  const rentalPerMin = Math.round((rental.price as number) / (rental.durationMin as number)); // 33 333
  const fmtK = (v: number) => `${Math.round(v / 1000)}к ₫/мин`;

  const tours = [pickService(site, "excursion"), pickService(site, "safari")];

  // Фото к карточкам выездов — по id услуги.
  const tourPhoto: Record<string, { src: string; alt: string }> = {
    excursion: {
      src: "/media/photo/ekskursiya.webp",
      alt: "Экскурсия на электрофойлах к острову Черепахи",
    },
    safari: {
      src: "/media/photo/club-3-v-more.webp",
      alt: "Сафари на электрофойлах: полдня в открытом море",
    },
  };

  return (
    <>
      <Section className="pt-10 sm:pt-14">
        <Container>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
            Клуб FlyGuru
          </p>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
            Абонемент и выезды для своих
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Клуб — это про регулярное катание по выгодной цене и доступ к экскурсиям
            и сафари вместе с командой.
          </p>
          {/* 21:9 — кадр открытого моря читается как баннер и не съедает экран. */}
          <VideoLoop
            src="/media/video/club-loop.mp4"
            poster="/media/video/club-loop-poster.jpg"
            ratio="21/9"
            className="mt-10"
            priority
          />
        </Container>
      </Section>

      {/* Абонемент */}
      <Section tone="muted">
        <Container>
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <SectionHeading eyebrow="Абонемент" title="300 минут катания" />
              <p className="mt-4 text-muted">
                Абонемент выгоднее разового проката и окупается уже с 5-й каталки.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-line bg-surface p-4">
                  <div className="text-sm text-muted">По абонементу</div>
                  <div className="mt-1 text-xl font-bold text-primary">{fmtK(subPerMin)}</div>
                </div>
                <div className="rounded-xl border border-line bg-surface p-4">
                  <div className="text-sm text-muted">Разовый прокат</div>
                  <div className="mt-1 text-xl font-bold text-ink">{fmtK(rentalPerMin)}</div>
                </div>
              </div>
            </div>

            <Card className="ring-2 ring-primary">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IconWaves className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold">{sub.name}</h3>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold text-primary">{formatVnd(sub.price)}</span>
                <span className="text-sm text-muted">/ {formatDuration(sub)}</span>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                <li className="flex gap-2"><IconCheck className="h-5 w-5 shrink-0 text-primary" /> Списывайте минуты, когда удобно</li>
                <li className="flex gap-2"><IconCheck className="h-5 w-5 shrink-0 text-primary" /> Цена минуты вдвое ниже разового проката</li>
                <li className="flex gap-2"><IconCheck className="h-5 w-5 shrink-0 text-primary" /> Выезды — по одобрению инструктора</li>
              </ul>
              <div className="mt-6">
                <Button href="/contacts" className="w-full">Купить абонемент</Button>
              </div>
              <p className="mt-3 text-xs text-muted">
                Минуты действуют 3 месяца, неиспользованный остаток можно передать другу.
                Первый абонемент необученного клиента включает обучающее занятие (60 минут).
              </p>
            </Card>
          </div>
        </Container>
      </Section>

      {/* Что даёт клуб. Раньше здесь был блок «Членство» с условиями, которых в
          жизни ещё нет (активация абонементом, привилегии по остатку минут) —
          убран, чтобы не обещать несуществующее. Останутся только пункты,
          которые школа реально выполняет сегодня. */}
      <Section>
        <Container>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <IconClub className="h-6 w-6" />
            </div>
            <SectionHeading eyebrow="Клуб" title="Что даёт клуб" />
          </div>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <ul className="space-y-3 text-muted">
              <li className="flex gap-2"><IconCheck className="h-5 w-5 shrink-0 text-primary" /> Экскурсии и сафари вместе с командой</li>
              <li className="flex gap-2"><IconCheck className="h-5 w-5 shrink-0 text-primary" /> Выгодная цена за минуту катания по абонементу</li>
              <li className="flex gap-2"><IconCheck className="h-5 w-5 shrink-0 text-primary" /> Катание с теми, кто уже уверенно стоит на крыле</li>
            </ul>
            <div className="grid grid-cols-3 gap-3">
              <Media
                src="/media/photo/club-kokos.webp"
                alt="Кокос на доске электрофойла посреди моря"
                ratio="1/1"
                rounded="rounded-xl"
                sizes="120px"
              />
              <Media
                src="/media/photo/club-napitok.webp"
                alt="Гость клуба с напитком на электрофойле"
                ratio="1/1"
                rounded="rounded-xl"
                sizes="120px"
              />
              <Media
                src="/media/photo/safari-ostrov.webp"
                alt="Электрофойлы на берегу острова во время сафари"
                ratio="1/1"
                rounded="rounded-xl"
                sizes="120px"
              />
            </div>
          </div>
        </Container>
      </Section>

      {/* Выезды — по одобрению инструктора */}
      <Section tone="muted">
        <Container>
          <SectionHeading
            eyebrow="Выезды"
            title="Экскурсия и сафари"
            subtitle="По одобрению инструктора: если уже уверенно катаете — можно и без абонемента. Неопытных в длительные выезды не берём."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {tours.map((s) => (
              <Card key={s.id} className="flex h-full flex-col">
                <Media
                  src={tourPhoto[s.id].src}
                  alt={tourPhoto[s.id].alt}
                  ratio="16/9"
                  className="mb-4"
                  sizes="(min-width: 768px) 50vw, 100vw"
                />
                <div className="mb-3 flex items-center gap-2">
                  <IconPin className="h-5 w-5 text-primary" />
                  <Badge>По одобрению инструктора</Badge>
                </div>
                <h3 className="text-lg font-bold">{s.name}</h3>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-primary">{formatVnd(s.price)}</span>
                  <span className="text-sm text-muted">/ {formatDuration(s)}</span>
                </div>
                <p className="mt-3 flex-1 text-sm text-muted">
                  {s.id === "excursion" &&
                    "Чёткая программа на 2–2,5 часа: полёт к острову Черепахи с инструктором, чтобы прокачать опыт в море."}
                  {s.id === "safari" &&
                    "Задача повышенной сложности: остров Обезьян, крутой резорт и дикий пляж Баунти. Маршрут гибкий — куда ехать, решаете вы вместе с гидом."}
                </p>
                {s.note && <p className="mt-2 text-xs text-muted">{s.note}.</p>}
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* Блок «Приведи друга» убран: личных ссылок у клиентов в системе нет,
          минуты за друзей нигде не начисляются, а скидка −10% на первое базовое
          обучение работает только по ссылке агента. Вернём, когда механика
          клиентских ссылок появится в CRM. */}
    </>
  );
}
