import { getAppUser } from "@/lib/auth";
import { SettingsForm } from "@/app/[locale]/instructor/settings/SettingsForm";

// Настройки профиля админа: имя и фото (видны в карточке сайдбара кабинета).
// Форму переиспользуем инструкторскую — экшен updateProfileAction self-scoped
// (пишет строку залогиненного юзера, requireStaff пускает и админа). Поле
// «Цель по ЗП» скрыто (showGoal=false): у админа нет прогресс-бара.

export default async function AdminSettingsPage() {
  const user = await getAppUser();
  if (!user) return null; // layout уже средиректил бы; страховка для типов

  return (
    <div>
      <h1 className="text-2xl font-bold">Настройки</h1>
      <p className="mt-1 text-sm text-muted">
        Имя и фото видны в кабинете.
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
    </div>
  );
}
