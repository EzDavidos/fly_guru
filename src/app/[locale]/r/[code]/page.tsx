// Заглушка реф-лендинга. Наполнение — Этап 2.
// [code] — реф-код из URL, позже зашивается в форму заявки (booking.ref_code).
export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return (
    <main>
      <h1>Реф-лендинг — /r/{code}</h1>
    </main>
  );
}
