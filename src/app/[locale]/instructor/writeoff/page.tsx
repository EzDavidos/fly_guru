import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { phoneDigits } from "@/lib/phone";
import { WriteOffForm } from "./WriteOffForm";

// Списание минут: поиск клиента → остаток крупно → внести каталку.

const inputClass =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

interface ClientRow {
  id: string;
  name: string;
  phone: string | null;
}

// Поиск по имени или номеру. Клиентов сотни — фильтруем в JS, как и в actions.
function matchClient(c: ClientRow, q: string): boolean {
  const qDigits = phoneDigits(q);
  if (qDigits.length >= 4 && phoneDigits(c.phone ?? "").includes(qDigits)) return true;
  return c.name.toLowerCase().includes(q.toLowerCase());
}

export default async function WriteOffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; client?: string }>;
}) {
  const { q, client: clientId } = await searchParams;
  const supabase = await createClient();

  // ── Выбранный клиент: показываем остаток и форму списания ──
  if (clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("id, name, phone")
      .eq("id", clientId)
      .maybeSingle();

    if (!client) {
      return <p className="text-muted">Клиент не найден.</p>;
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("id, total_minutes, expires_at, status")
      .eq("client_id", client.id)
      .eq("status", "active")
      .order("sold_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let left: number | null = null;
    if (sub) {
      const { data: used } = await supabase
        .from("sessions")
        .select("minutes_used")
        .eq("subscription_id", sub.id);
      left = sub.total_minutes - (used ?? []).reduce((s, r) => s + (r.minutes_used ?? 0), 0);
    }

    return (
      <div>
        <Link href="/instructor/writeoff" className="text-sm text-primary underline">
          ← К поиску
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{client.name}</h1>
        {client.phone && <p className="text-sm text-muted">{client.phone}</p>}

        {sub && left != null ? (
          <>
            {/* Остаток — крупно, это главное число экрана. */}
            <div className="mt-6 rounded-2xl border border-line bg-surface p-6 text-center">
              <p className="text-sm text-muted">Остаток на абонементе</p>
              <p className="mt-1 text-5xl font-bold text-primary">{left}</p>
              <p className="text-sm text-muted">минут</p>
              {sub.expires_at && (
                <p className="mt-2 text-xs text-muted">
                  Действует до {sub.expires_at.slice(0, 10)}
                </p>
              )}
            </div>
            <div className="mt-6">
              <WriteOffForm clientId={client.id} clientName={client.name} left={left} />
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-2xl border border-line bg-surface p-6 text-center text-muted">
            У клиента нет активного абонемента.
            <Link href="/instructor/subscription" className="mt-2 block text-primary underline">
              Продать абонемент
            </Link>
          </div>
        )}
      </div>
    );
  }

  // ── Поиск клиента ──
  let results: ClientRow[] = [];
  if (q && q.trim()) {
    const { data } = await supabase
      .from("clients")
      .select("id, name, phone")
      .order("created_at", { ascending: false })
      .limit(1000);
    results = ((data ?? []) as ClientRow[]).filter((c) => matchClient(c, q.trim())).slice(0, 10);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Списать минуты</h1>
      <p className="mt-1 text-sm text-muted">Найдите клиента по имени или телефону.</p>

      <form method="get" className="mt-6 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Имя или телефон"
          className={inputClass}
          autoFocus
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-strong"
        >
          Найти
        </button>
      </form>

      {q && (
        <div className="mt-6 space-y-3">
          {results.length === 0 && (
            <p className="text-center text-sm text-muted">Никого не нашли по «{q}».</p>
          )}
          {results.map((c) => (
            <Link
              key={c.id}
              href={`/instructor/writeoff?client=${c.id}`}
              className="block rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-primary"
            >
              <p className="font-bold">{c.name}</p>
              {c.phone && <p className="text-sm text-muted">{c.phone}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
