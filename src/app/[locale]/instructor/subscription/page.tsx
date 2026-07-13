import { formatVnd } from "@/content/services";
import { getSiteServices, pickService } from "@/lib/services";
import { SubscriptionForm } from "./SubscriptionForm";

// Продажа абонемента: 300 минут / 6 млн ₫, минуты живут 3 месяца.
// Создаёт subscription (sold_by = инструктор) и членство клуба, если его нет.

export default async function SubscriptionPage() {
  const sub = pickService(await getSiteServices(), "subscription");

  return (
    <div>
      <h1 className="text-2xl font-bold">Продать абонемент</h1>
      <p className="mt-1 text-sm text-muted">
        {sub.durationMin} минут за {formatVnd(sub.price)}. Минуты действуют 3 месяца.
        Продажа записывается на вас — 10% с оплаченного абонемента ваши.
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
