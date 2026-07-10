import { Link } from "@/i18n/navigation";

// Экран результата после действия в кабинете. Показывает, что именно сделали,
// и возвращает на чистую форму одной кнопкой («Записать следующего»).

function vnd(n: number): string {
  return `${n.toLocaleString("ru-RU")} ₫`;
}

export default async function DonePage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    name?: string;
    amount?: string;
    service?: string;
    discount?: string;
    paid?: string;
    minutes?: string;
    left?: string;
  }>;
}) {
  const p = await searchParams;
  const amount = Number(p.amount ?? 0);

  let title = "Готово!";
  let details: string[] = [];
  let nextHref = "/instructor/record";
  let nextLabel = "Записать следующего";

  if (p.type === "session") {
    title = "Клиент записан";
    details = [
      `${p.name ?? "Клиент"} — ${p.service ?? "услуга"}`,
      `Чек: ${vnd(amount)}${p.discount ? " (со скидкой 200 000 ₫ по реф-ссылке)" : ""}`,
      "Сессия записана на вас.",
    ];
  } else if (p.type === "subscription") {
    title = "Абонемент продан";
    details = [
      `${p.name ?? "Клиент"} — абонемент 300 минут`,
      p.paid
        ? "Оплата получена — 10% попадут в вашу ЗП."
        : "Оплата не отмечена — админ отметит позже, тогда 10% попадут в ЗП.",
      "Клиент теперь член клуба.",
    ];
    nextHref = "/instructor/subscription";
    nextLabel = "Продать ещё";
  } else if (p.type === "writeoff") {
    title = "Минуты списаны";
    details = [
      `${p.name ?? "Клиент"}: −${p.minutes ?? "?"} мин`,
      `Остаток: ${p.left ?? "?"} мин`,
    ];
    nextHref = "/instructor/writeoff";
    nextLabel = "Списать ещё";
  }

  return (
    <div className="pt-8 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl">
        ✅
      </div>
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="mt-3 space-y-1 text-muted">
        {details.map((d) => (
          <p key={d}>{d}</p>
        ))}
      </div>
      <div className="mt-8 flex flex-col gap-3">
        <Link
          href={nextHref}
          className="inline-flex w-full items-center justify-center rounded-full bg-accent px-7 py-4 text-base font-semibold text-white transition-colors hover:bg-accent-strong"
        >
          {nextLabel}
        </Link>
        <Link
          href="/instructor"
          className="inline-flex w-full items-center justify-center rounded-full border border-line px-7 py-4 text-base font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
        >
          К заявкам
        </Link>
      </div>
    </div>
  );
}
