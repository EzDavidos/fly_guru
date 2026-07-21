import { formatVnd } from "@/content/services";
import { getSiteServices, pickService } from "@/lib/services";
import { SubscriptionForm } from "./SubscriptionForm";

// Продажа абонемента: 300 минут / 6 млн ₫, минуты живут 3 месяца.
// Создаёт subscription (sold_by = инструктор). Членом клуба клиент при этом
// НЕ становится — клуб запустим отдельно.

export default async function SubscriptionPage() {
  const sub = pickService(await getSiteServices(), "subscription");

  return (
    <div>
      <h1 className="text-2xl font-bold">Продать абонемент</h1>
      <p className="mt-1 text-sm text-muted">
        {sub.durationMin} минут за {formatVnd(sub.price)}. Минуты действуют 3 месяца.
        После оплаты 15% идут в общий котёл и делятся поровну между всеми
        инструкторами — неважно, кто продал.
      </p>
      <div className="mt-6">
        <SubscriptionForm />
      </div>
      <p className="mt-4 text-xs text-muted">
        Если клиент ещё не обучен, первые 60 минут абонемента — обучающее занятие.
      </p>
    </div>
  );
}
