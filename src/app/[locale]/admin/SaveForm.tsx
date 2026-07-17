"use client";

import { useActionState } from "react";

// Форма админки, которая вслух говорит «Сохранено», когда запись прошла.
//
// Зачем: правка полей (имя клиента, сумма сессии, цена услуги) выглядела как
// «ничего не произошло» — страница перерисовывалась той же самой, и понять,
// записалось или нет, было нельзя. Особенно больно при заполнении CRM пачкой.
//
// Провал сохранения сюда не долетает: экшены кидают ошибку (см. failIfError в
// actions.ts), её ловит admin/error.tsx. Поэтому «Сохранено» здесь означает
// именно успех, а не «форма отправилась».
//
// Кнопки с собственным formAction (смена статуса заявки и т.п.) идут мимо этой
// обёртки — у них своя обратная связь: меняется бейдж в карточке.
export function SaveForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  className?: string;
  children: React.ReactNode;
}) {
  const [saved, formAction, pending] = useActionState(
    async (_prev: boolean, formData: FormData) => {
      await action(formData);
      return true;
    },
    false,
  );

  return (
    <form action={formAction} className={className}>
      {children}
      {saved && !pending && (
        <p className="mt-2 text-xs font-semibold text-emerald-600">Сохранено ✓</p>
      )}
    </form>
  );
}
