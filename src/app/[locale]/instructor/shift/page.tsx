import type { Metadata } from "next";
import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { vnToday } from "@/lib/dates";
import { getShiftForDay } from "@/lib/shifts";
import { getActiveEquipment } from "@/lib/equipment";
import { ShiftPanel } from "./ShiftPanel";

export const metadata: Metadata = { title: "Смена" };

// Экран «Смена» (пак C): инструктор утром открывает смену и снимает доску с
// крылом, вечером — закрывает и снимает снова. По парам снимков босс видит, что
// изменилось за день. Правила времени и статусы — в shiftRules.ts.

export default async function InstructorShiftPage() {
  const user = await getAppUser();
  if (!user) return null; // layout уже средиректил бы; страховка для типов

  const supabase = await createClient();
  const [shift, equipment] = await Promise.all([
    getShiftForDay(supabase, user.id, vnToday()),
    getActiveEquipment(supabase),
  ]);

  const boards = equipment.filter((e) => e.kind === "board");
  const wings = equipment.filter((e) => e.kind === "wing");

  return (
    <div>
      <h1 className="text-2xl font-bold">Смена</h1>
      <p className="mt-1 text-sm text-muted">
        Утром откройте смену и сфотографируйте доску и крыло, вечером —
        закройте. Снимайте прямо с камеры.
      </p>

      {boards.length === 0 && wings.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
          Инвентарь ещё не заведён — попросите админа добавить доски и крылья в
          Настройках. Без списка нечего привязать к фото.
        </p>
      ) : (
        <div className="mt-6">
          <ShiftPanel shift={shift} boards={boards} wings={wings} />
        </div>
      )}
    </div>
  );
}
