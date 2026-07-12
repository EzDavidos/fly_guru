import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CopyLink } from "../CopyLink";

export const metadata: Metadata = { title: "Админка · Материалы" };

// Шпаргалка владельца: готовые меченые ссылки для рекламы. Метка ?src=
// приклеивается к гостю на 30 дней (lib/attribution.ts) и приходит вместе
// с его заявкой — так видно, какой канал реально приводит людей.
// Плюс реф-ссылки активных агентов — раздать не заходя в «Агентов».

const CHANNELS: { label: string; hint: string; path: string }[] = [
  {
    label: "Instagram",
    hint: "в шапку профиля и в сторис",
    path: "/?src=instagram",
  },
  {
    label: "QR-код",
    hint: "зашить в QR на стойке или баннере",
    path: "/?src=qr",
  },
  {
    label: "Флаер",
    hint: "печатные листовки и визитки",
    path: "/?src=flyer",
  },
  {
    label: "Партнёр",
    hint: "отели, кафе, прокаты без личного реф-кода",
    path: "/?src=partner",
  },
];

interface AgentLinkRow {
  id: string;
  ref_code: string;
  user: { name: string } | null;
}

export default async function AdminMaterialsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agents")
    .select("id, ref_code, user:users!user_id(name)")
    .eq("active", true);
  const agents = ((data ?? []) as unknown as AgentLinkRow[]).sort((a, b) =>
    (a.user?.name ?? "").localeCompare(b.user?.name ?? "", "ru"),
  );

  return (
    <div>
      <h1 className="text-2xl font-bold">Материалы</h1>
      <p className="mt-1 text-sm text-muted">
        Готовые ссылки для рекламы. Метка держится за гостем 30 дней и видна
        в его заявке — так понятно, какой канал сработал.
      </p>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-bold">Каналы</h2>
        <div className="mt-3 space-y-3">
          {CHANNELS.map((ch) => (
            <div key={ch.path}>
              <p className="text-sm font-semibold">
                {ch.label} <span className="font-normal text-muted">· {ch.hint}</span>
              </p>
              <div className="mt-1">
                <CopyLink path={ch.path} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-bold">Ссылки агентов</h2>
        <p className="mt-1 text-xs text-muted">
          Личные ссылки активных агентов — гость по ним получает скидку 200 000 ₫.
        </p>
        {agents.length === 0 && (
          <p className="mt-3 text-sm text-muted">Активных агентов нет.</p>
        )}
        <div className="mt-3 space-y-3">
          {agents.map((a) => (
            <div key={a.id}>
              <p className="text-sm font-semibold">{a.user?.name ?? "агент"}</p>
              <div className="mt-1">
                <CopyLink path={`/r/${a.ref_code}`} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
