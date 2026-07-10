import { getAppUser } from "@/lib/auth";
import { SettingsForm } from "./SettingsForm";

// Настройки профиля: отображаемое имя, фото, возраст, личная цель по ЗП
// (питает прогресс-бар на главном экране кабинета).

export default async function SettingsPage() {
  const user = await getAppUser();
  if (!user) return null; // layout уже средиректил бы; страховка для типов

  return (
    <div>
      <h1 className="text-2xl font-bold">Настройки</h1>
      <p className="mt-1 text-sm text-muted">
        Имя и фото видны в кабинете. Цель по ЗП — только ваша, для мотивации.
      </p>
      <div className="mt-6">
        <SettingsForm
          name={user.name}
          photoUrl={user.photo_url}
          age={user.age}
          monthlyGoal={user.monthly_goal}
        />
      </div>
    </div>
  );
}
