import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { vnToday } from "@/lib/dates";
import { RecordClientForm, type RecordPrefill } from "./RecordClientForm";

export const metadata: Metadata = { title: "Админка · Запись клиента" };

// «Записать клиента» из кабинета админа: провести занятие на выбранного
// инструктора (по умолчанию — сам админ, он же записывает и иногда сам катает).
// Может закрыть заявку и учесть агентскую скидку/награду (?booking=id).
// Постит в общий createSessionAction (см. bookingId там).

export default async function AdminRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>;
}) {
  const { booking: bookingId } = await searchParams;
  const supabase = await createClient();
  const admin = await getAppUser();

  const [servicesRes, staffRes] = await Promise.all([
    // Без subscription: абонемент — не сессия (своя форма с минутами/членством).
    supabase
      .from("services")
      .select("id, name, price")
      .eq("active", true)
      .neq("category", "subscription")
      .order("name"),
    supabase.from("users").select("id, name").in("role", ["instructor", "admin"]).order("name"),
  ]);
  const services = (servicesRes.data ?? []).map((s) => ({
    ...s,
    price: Number(s.price ?? 0),
  }));
  const staff = staffRes.data ?? [];

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
        Проведённое занятие. По умолчанию инструктор — вы; выберите другого, если
        катал он. Заявку из ленты можно закрыть этой же записью.
      </p>
      <div className="mt-6 max-w-xl">
        <RecordClientForm
          services={services}
          staff={staff}
          today={vnToday()}
          defaultInstructorId={admin?.id ?? staff[0]?.id ?? ""}
          prefill={prefill}
        />
      </div>
    </div>
  );
}
