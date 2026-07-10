// Тот же скелетон, что в кабинете инструктора: без него при заходе в админку
// экран замирает, пока сервер ходит в базу. Обёртку-колонку даёт layout.
export default function AdminLoading() {
  return (
    <div aria-busy="true" className="animate-pulse">
      <div className="h-7 w-40 rounded-lg bg-line/60" />
      <div className="mt-2 h-4 w-64 rounded bg-line/40" />
      <div className="mt-6 space-y-3">
        <div className="h-28 rounded-2xl bg-line/40" />
        <div className="h-28 rounded-2xl bg-line/30" />
        <div className="h-28 rounded-2xl bg-line/20" />
      </div>
    </div>
  );
}
