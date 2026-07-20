import { getAppUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getFullDict } from "@/lib/dictionaries";
import { SettingsForm } from "@/app/[locale]/instructor/settings/SettingsForm";
import { DictionaryManager } from "./DictionaryManager";

// Настройки админа: профиль (имя и фото — видны в карточке сайдбара кабинета)
// и справочники школы (пак A). Форму профиля переиспользуем инструкторскую —
// экшен updateProfileAction self-scoped (пишет строку залогиненного юзера,
// requireStaff пускает и админа). Поле «Цель по ЗП» скрыто (showGoal=false):
// у админа нет прогресс-бара.

export default async function AdminSettingsPage() {
  const user = await getAppUser();
  if (!user) return null; // layout уже средиректил бы; страховка для типов

  const supabase = await createClient();
  const [categories, methods] = await Promise.all([
    getFullDict(supabase, "expense_categories"),
    getFullDict(supabase, "payment_methods"),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Настройки</h1>
      <p className="mt-1 text-sm text-muted">
        Имя и фото видны в кабинете. Справочники ниже питают формы расходов и
        оплаты.
      </p>
      <div className="mt-6">
        <SettingsForm
          name={user.name}
          photoUrl={user.photo_url}
          age={user.age}
          monthlyGoal={user.monthly_goal}
          showGoal={false}
        />
      </div>

      <div className="mt-6 space-y-3">
        <DictionaryManager
          table="expense_categories"
          title="Категории расходов"
          hint="Из этого списка выбирают категорию вы и инструкторы при внесении расхода."
          placeholder="Топливо"
          items={categories}
        />
        <DictionaryManager
          table="payment_methods"
          title="Форматы оплаты"
          hint="Чем платил клиент. Обязателен при записи сессии, необязателен в заявке."
          placeholder="QR"
          items={methods}
        />
      </div>
    </div>
  );
}
