// Поле «Формат оплаты» для форм записи и продажи абонемента.
//
// Живёт отдельным компонентом ради одной вещи: если форму открыли из заявки, а
// админ при подтверждении уже выбрал способ оплаты, спрашивать его второй раз
// незачем — он приезжает выбранным. Значение остаётся обычным: платили иначе —
// поменяли, в базу уйдёт то, что стоит в форме на момент отправки.
//
// Серверный компонент: интерактива тут нет, только defaultValue у select.

export interface PaymentMethodOption {
  id: string;
  name: string;
}

// Кабинет инструктора — крупные поля с подписью над ними (палец, пляж, солнце);
// админка — компактные внутри <label> общей сетки. Классы самого select каждая
// форма передаёт свои (как в PhoneField), поэтому variant решает только обёртку.
type Variant = "cabinet" | "compact";

export function PaymentMethodField({
  methods,
  selectedId,
  selectedName,
  required = true,
  className,
  variant = "cabinet",
}: {
  methods: PaymentMethodOption[];
  /** Способ из заявки — его выбрал админ. Нет заявки → поле пустое, как раньше. */
  selectedId?: string | null;
  /** Имя способа из заявки: нужно, если его успели скрыть в справочнике. */
  selectedName?: string | null;
  required?: boolean;
  className: string;
  variant?: Variant;
}) {
  const fromBooking = Boolean(selectedId);
  // Способ мог быть скрыт в справочнике уже после подтверждения заявки. Без
  // запасного пункта select не нашёл бы своё значение и молча съехал бы на
  // первый вариант — та же защита стоит в карточке заявки у админа.
  const missing = fromBooking && !methods.some((p) => p.id === selectedId);

  const select = (
    // Подсвечиваем кольцом, а не цветом рамки: рамку задаёт className формы, и
    // два класса border-* дрались бы за один и тот же CSS-свойство.
    <select
      id="paymentMethodId"
      name="paymentMethodId"
      required={required}
      defaultValue={selectedId ?? ""}
      className={`${className} ${fromBooking ? "ring-2 ring-accent" : ""}`}
    >
      {/* Пустой пункт disabled: иначе он стал бы значением по умолчанию. */}
      <option value="" disabled={required}>
        Выберите…
      </option>
      {methods.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
      {missing && <option value={selectedId!}>{selectedName ?? "прежний способ"}</option>}
    </select>
  );

  const hint = fromBooking ? (
    <p className={`mt-1 ${variant === "cabinet" ? "text-xs" : "text-[11px]"} text-accent-strong`}>
      Способ указал админ при подтверждении заявки. Клиент заплатил иначе —
      просто поменяйте.
    </p>
  ) : null;

  const label = `Формат оплаты${required ? " *" : ""}`;

  // В админке поле уже лежит внутри <label> общей сетки — там отдаём такой же
  // <label>, чтобы не ломать вёрстку колонок и не плодить вложенные label.
  return variant === "cabinet" ? (
    <div>
      <label htmlFor="paymentMethodId" className="mb-1 block text-sm font-medium">
        {label}
      </label>
      {select}
      {hint}
    </div>
  ) : (
    <label className="block text-xs text-muted">
      {label}
      {select}
      {hint}
    </label>
  );
}
