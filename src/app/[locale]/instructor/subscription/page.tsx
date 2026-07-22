import { formatVnd } from "@/content/services";
import { getSiteServices, pickService } from "@/lib/services";
import { createClient } from "@/lib/supabase/server";
import { SubscriptionForm } from "./SubscriptionForm";

// Продажа абонемента: 300 минут / 6 млн ₫, минуты живут 3 месяца.
// Создаёт subscription (sold_by = инструктор). Членом клуба клиент при этом
// НЕ становится — клуб запустим отдельно.

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>;
}) {
  const { booking: bookingId } = await searchParams;
  const sub = pickService(await getSiteServices(), "subscription");

  // Пришли из заявки на абонемент («Продать абонемент» в списке записей):
  // тянем контакты клиента, чтобы форма открылась заполненной, а продажа
  // закрыла заявку (пачка №5, п.11).
  let prefill: { bookingId: string; name: string; phone: string; telegram: string | null } | undefined;
  if (bookingId) {
    const supabase = await createClient();
    const { data: b } = await supabase
      .from("bookings")
      .select("id, status, client_name, phone, telegram_username")
      .eq("id", bookingId)
      .maybeSingle();
    if (b && !["done", "cancelled", "archived"].includes(b.status)) {
      prefill = {
        bookingId: b.id,
        name: b.client_name,
        phone: b.phone,
        telegram: b.telegram_username,
      };
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Продать абонемент</h1>
      <p className="mt-1 text-sm text-muted">
        {sub.durationMin} минут за {formatVnd(sub.price)}. Минуты действуют 3 месяца.
        После оплаты 15% идут в общий котёл и делятся поровну между всеми
        инструкторами — неважно, кто продал.
      </p>
      {prefill && (
        <p className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-sm text-primary">
          Заявка от <b>{prefill.name}</b> — продажа закроет её.
        </p>
      )}
      <div className="mt-6">
        <SubscriptionForm prefill={prefill} />
      </div>
      <p className="mt-4 text-xs text-muted">
        Если клиент ещё не обучен, первые 60 минут абонемента — обучающее занятие.
      </p>
    </div>
  );
}
