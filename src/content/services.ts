// Единый справочник услуг и цен FlyGuru.
// ИСТОЧНИК ПРАВДЫ: docs/flyguru_architecture.md, раздел 3.
// Все цены на страницах и в прайсе берутся отсюда → расхождений быть не может.

export type Vnd = number | null;

export type ServiceCategory =
  | "training"
  | "tandem"
  | "rental"
  | "tour"
  | "subscription"
  | "extra";

export interface Service {
  id: string;
  name: string;
  durationMin: number | null;
  durationLabel?: string; // если длительность не в минутах («полдня», «целый день»)
  price: Vnd; // null = цена не определена (TODO/по запросу)
  category: ServiceCategory;
  membersOnly?: boolean;
  note?: string;
}

export const services: Service[] = [
  // ── Обучение ──
  { id: "basic-adult", name: "Базовое обучение (взрослый)", durationMin: 60, price: 2_000_000, category: "training" },
  { id: "basic-kid", name: "Базовое обучение (до 14 лет)", durationMin: 60, price: 1_500_000, category: "training" },
  { id: "basic-duo", name: "Базовое обучение вдвоём", durationMin: 60, price: 3_500_000, category: "training" },

  // ── Тандем ──
  { id: "tandem-adult", name: "Тандем с инструктором (взрослый)", durationMin: 5, price: 1_000_000, category: "tandem" },
  { id: "tandem-kid", name: "Тандем с инструктором (до 14 лет)", durationMin: 5, price: 500_000, category: "tandem" },

  // ── Выезды (только для членов клуба) ──
  { id: "excursion", name: "Экскурсия вдоль побережья", durationMin: 120, price: 3_500_000, category: "tour", membersOnly: true },
  {
    id: "journey",
    name: "Путешествие (несколько локаций)",
    durationMin: null,
    durationLabel: "полдня",
    price: null, // TODO: цена «путешествия»
    category: "tour",
    membersOnly: true,
  },
  { id: "safari", name: "Сафари", durationMin: null, durationLabel: "целый день", price: 6_000_000, category: "tour", membersOnly: true },

  // ── Прокат ──
  { id: "rental", name: "Самостоятельный прокат (после обучения)", durationMin: 30, price: 1_000_000, category: "rental" },

  // ── Абонемент ──
  { id: "subscription", name: "Абонемент", durationMin: 300, price: 6_000_000, category: "subscription" },

  // ── Доп. услуги ──
  { id: "video", name: "Видеосъёмка полёта (Insta360, монтаж)", durationMin: null, durationLabel: "—", price: 1_200_000, category: "extra" },
];

export function getService(id: string): Service {
  const s = services.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown service id: ${id}`);
  return s;
}

// «2 000 000 ₫» / «по запросу» для null
export function formatVnd(price: Vnd): string {
  if (price == null) return "по запросу";
  return `${price.toLocaleString("ru-RU")} ₫`;
}

// «60 мин» / кастомная метка / «—»
export function formatDuration(s: Pick<Service, "durationMin" | "durationLabel">): string {
  if (s.durationMin != null) return `${s.durationMin} мин`;
  return s.durationLabel ?? "—";
}

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  training: "Обучение",
  tandem: "Тандем",
  tour: "Выезды",
  rental: "Прокат",
  subscription: "Абонемент",
  extra: "Дополнительно",
};
