import { createClient } from "@/lib/supabase/server";
import { vnToday } from "@/lib/dates";
import { RecordForm, type RecordPrefill } from "./RecordForm";

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

  // Услуги из базы: форма отправляет uuid услуги, цена подставится на сервере.
  const { data: services } = await supabase
    .from("services")
    .select("id, name")
    .eq("active", true)
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
      <div className="mt-6">
        <RecordForm services={services ?? []} today={vnToday()} prefill={prefill} />
      </div>
    </div>
  );
}
