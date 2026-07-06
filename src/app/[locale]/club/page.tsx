import type { Metadata } from "next";
import { Container, Section, SectionHeading, Card, Button, Badge } from "@/components/ui";
import { IconCheck, IconWaves, IconPin, IconClub } from "@/components/icons";
import { getService, formatVnd, formatDuration } from "@/content/services";

export const metadata: Metadata = { title: "Клуб" };
export const dynamic = "force-static"; // статичная страница, форсим SSG

export default function ClubPage() {
  const sub = getService("subscription");
  const rental = getService("rental");

  // Аргумент выгоды считаем из данных, чтобы не разошлось с прайсом.
  const subPerMin = Math.round((sub.price as number) / (sub.durationMin as number)); // 20 000
  const rentalPerMin = Math.round((rental.price as number) / (rental.durationMin as number)); // 33 333
  const fmtK = (v: number) => `${Math.round(v / 1000)}к ₫/мин`;

  const tours = [getService("excursion"), getService("journey"), getService("safari")];

  return (
    <>
      <Section className="pt-10 sm:pt-14">
        <Container>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary">
            Клуб FlyGuru
          </p>
          <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
            Абонемент, членство и выезды для своих
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Клуб — это про регулярное катание по выгодной цене и доступ к экскурсиям,
            путешествиям и сафари вместе с командой.
          </p>
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
                <li className="flex gap-2"><IconCheck className="h-5 w-5 shrink-0 text-primary" /> Активирует членство в клубе</li>
                <li className="flex gap-2"><IconCheck className="h-5 w-5 shrink-0 text-primary" /> Открывает доступ к выездам</li>
              </ul>
              <div className="mt-6">
                <Button href="/contacts" className="w-full">Купить абонемент</Button>
              </div>
              {/* TODO: срок жизни минут абонемента (обсуждается ~6 мес) */}
              <p className="mt-3 text-xs text-muted">Первый абонемент необученного клиента включает обучающее занятие.</p>
            </Card>
          </div>
        </Container>
      </Section>

      {/* Членство */}
      <Section>
        <Container>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IconClub className="h-6 w-6" />
                </div>
                <SectionHeading eyebrow="Членство" title="Как это работает" />
              </div>
              <ul className="mt-6 space-y-3 text-muted">
                <li className="flex gap-2"><IconCheck className="h-5 w-5 shrink-0 text-primary" /> Членство активируется покупкой первого абонемента.</li>
                <li className="flex gap-2"><IconCheck className="h-5 w-5 shrink-0 text-primary" /> Клубные привилегии (выезды, «приведи друга», скидки) действуют, пока на абонементе есть минуты.</li>
                <li className="flex gap-2"><IconCheck className="h-5 w-5 shrink-0 text-primary" /> Закончились минуты — просто продлите абонемент, и привилегии снова активны.</li>
              </ul>
            </div>
            <Card className="bg-surface-2">
              <h3 className="font-bold">Что даёт клуб</h3>
              <ul className="mt-4 space-y-2 text-sm text-muted">
                <li className="flex gap-2"><IconCheck className="h-5 w-5 shrink-0 text-primary" /> Экскурсии, путешествия и сафари</li>
                <li className="flex gap-2"><IconCheck className="h-5 w-5 shrink-0 text-primary" /> Минуты за приглашённых друзей</li>
                <li className="flex gap-2"><IconCheck className="h-5 w-5 shrink-0 text-primary" /> Выгодная цена за минуту катания</li>
              </ul>
            </Card>
          </div>
        </Container>
      </Section>

      {/* Выезды — только для членов клуба */}
      <Section tone="muted">
        <Container>
          <SectionHeading
            eyebrow="Выезды"
            title="Экскурсии, путешествия и сафари"
            subtitle="Только для членов клуба. Требуется пройденное базовое обучение — неопытных в длительные выезды не берём."
          />
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {tours.map((s) => (
              <Card key={s.id} className="flex h-full flex-col">
                <div className="mb-3 flex items-center gap-2">
                  <IconPin className="h-5 w-5 text-primary" />
                  <Badge>Только для членов клуба</Badge>
                </div>
                <h3 className="text-lg font-bold">{s.name}</h3>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-primary">{formatVnd(s.price)}</span>
                  <span className="text-sm text-muted">/ {formatDuration(s)}</span>
                </div>
                <p className="mt-3 flex-1 text-sm text-muted">
                  {s.id === "excursion" && "Полёт вдоль побережья Нячанга с инструктором."}
                  {s.id === "journey" && "Полдня и несколько локаций за один выезд."}
                  {s.id === "safari" && "Целый день на воде — максимум впечатлений."}
                </p>
                {s.id === "journey" && (
                  /* TODO: определить и указать цену «путешествия» */
                  <p className="mt-2 text-xs text-muted">Цена уточняется.</p>
                )}
              </Card>
            ))}
          </div>
        </Container>
      </Section>

      {/* Приведи друга */}
      <Section>
        <Container>
          <div className="rounded-3xl border border-line bg-surface p-8 sm:p-10">
            <SectionHeading eyebrow="Приведи друга" title="Дари скидку — получай минуты" />
            <p className="mt-4 max-w-2xl text-muted">
              У каждого члена клуба есть личная ссылка. Друг получает скидку 200 000 ₫ на
              базовое обучение, а вам после его первого занятия начисляются минуты на
              абонемент.
              {/* TODO: подтвердить размер награды (обсуждается +30 мин) */}
            </p>
            <div className="mt-6">
              <Button href="/contacts" variant="secondary">Стать членом клуба</Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
