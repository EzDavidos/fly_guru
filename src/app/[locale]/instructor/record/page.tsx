import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { vnToday } from "@/lib/dates";
import { CopyLink } from "@/app/[locale]/admin/CopyLink";
import { RecordForm, type RecordPrefill } from "./RecordForm";
import { createMyRefCodeAction } from "../actions";

// «Записать клиента»: имя, телефон, услуга, дата → клиент + сессия.
// Сценарий: оформить человека на пляже за 30 секунд сразу после занятия.
// Если пришли из заявки (?booking=id) — поля уже заполнены.

export default async function RecordPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>;
}) {
  const { booking: bookingId } = await searchParams;
  const supabase = await createClient();
  const user = await getAppUser();

  // Личный реф-код инструктора берём отдельным запросом (а НЕ через getAppUser),
  // чтобы до наката 0011 не ронять авторизацию во всех кабинетах. RLS
  // users_select_own разрешает читать свою строку.
  let myRefCode: string | null = null;
  if (user?.role === "instructor") {
    const { data: me } = await supabase
      .from("users")
      .select("ref_code")
      .eq("id", user.id)
      .maybeSingle();
    myRefCode = (me?.ref_code as string | null) ?? null;
  }

  // Услуги из базы: форма отправляет uuid услуги, цена подставится на сервере.
  // Без категории subscription: абонемент — не сессия, он продаётся через
  // «Продажу абонемента» (иначе клиент не получит минуты и членство).
  const { data: services } = await supabase
    .from("services")
    .select("id, name")
    .eq("active", true)
    .neq("category", "subscription")
    .order("price", { ascending: true, nullsFirst: false });

  let prefill: RecordPrefill | undefined;
  if (bookingId) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, client_name, phone, service_id, ref_code")
      .eq("id", bookingId)
      .maybeSingle();
    if (booking) {
      prefill = {
        bookingId: booking.id,
        name: booking.client_name,
        phone: booking.phone,
        serviceId: booking.service_id ?? undefined,
        refCode: booking.ref_code,
      };
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Записать клиента</h1>
      <p className="mt-1 text-sm text-muted">
        Сессия запишется на вас — вы и получите 10% от чека.
      </p>

      {/* Личная реф-ссылка (пак C): дайте её клиенту вне дома — он запишется
          сразу на вас, без скидки. Показываем только инструкторам. */}
      {user?.role === "instructor" && (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
          <p className="text-sm font-semibold">Моя ссылка для записи</p>
          <p className="mt-1 text-xs text-muted">
            Клиент по ней запишется напрямую на вас (без скидки — она только у агентов).
          </p>
          <div className="mt-3">
            {myRefCode ? (
              <CopyLink path={`/r/${myRefCode}`} />
            ) : (
              <form action={createMyRefCodeAction}>
                <button
                  type="submit"
                  className="rounded-full border border-line px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
                >
                  Создать мою ссылку
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="mt-6">
        <RecordForm services={services ?? []} today={vnToday()} prefill={prefill} />
      </div>
    </div>
  );
}
