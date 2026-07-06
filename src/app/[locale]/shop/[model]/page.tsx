// Заглушка карточки фойла. Наполнение — Этап 6.
// [model] — динамический сегмент (slug модели из URL).
export default async function ShopModelPage({
  params,
}: {
  params: Promise<{ model: string }>;
}) {
  const { model } = await params;
  return (
    <main>
      <h1>Карточка фойла — /shop/{model}</h1>
    </main>
  );
}
