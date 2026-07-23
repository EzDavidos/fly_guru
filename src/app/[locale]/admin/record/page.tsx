import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getAppUser } from "@/lib/auth";
import { vnToday } from "@/lib/dates";
import { getActiveDict } from "@/lib/dictionaries";
import { RecordClientForm, type RecordPrefill } from "./RecordClientForm";
import { firstBasicTrainingByPhone } from "@/lib/agentReward";

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
  const paymentMethods = await getActiveDict(supabase, "payment_methods");

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

  const today = vnToday();

  let prefill: RecordPrefill | undefined;
  if (bookingId) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, client_name, phone, service_id, ref_code, preferred_date, telegram_username")
      .eq("id", bookingId)
      .maybeSingle();
    if (booking) {
      // Дату занятия берём из заявки: админ уже договорился с клиентом на этот
      // день, и запись должна лечь именно туда, а не на «сегодня». Будущую дату
      // не подставляем — занятие ещё не состоялось, а поле не пускает вперёд.
      const day = booking.preferred_date as string | null;
      prefill = {
        bookingId: booking.id,
        name: booking.client_name,
        phone: booking.phone,
        serviceId: booking.service_id ?? undefined,
        refCode: booking.ref_code,
        telegram: booking.telegram_username,
        date: day && day <= today ? day : today,
      };
      // Чей это код и положена ли гостю скидка — та же проверка, что делает
      // расчёт чека: скидку даёт только активный агент и только за первое
      // базовое обучение клиента.
      if (booking.ref_code) {
        const { data: agent } = await supabase
          .from("agents")
          .select("id")
          .eq("ref_code", booking.ref_code)
          .eq("active", true)
          .maybeSingle();
        prefill.refIsAgent = Boolean(agent);
        if (prefill.refIsAgent) {
          const known = await firstBasicTrainingByPhone(supabase, [booking.phone]);
          prefill.refDiscount = known.get(booking.phone as string);
        }
      }
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
          today={today}
          defaultInstructorId={admin?.id ?? staff[0]?.id ?? ""}
          paymentMethods={paymentMethods}
          prefill={prefill}
        />
      </div>
    </div>
  );
}
