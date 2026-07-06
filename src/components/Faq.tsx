import type { ReactNode } from "react";

// FAQ на нативном <details> — раскрывается без JavaScript (быстро и доступно).
export interface FaqEntry {
  q: string;
  a: ReactNode;
}

export function Faq({ items }: { items: FaqEntry[] }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
      {items.map((item, i) => (
        <details key={i} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 font-semibold">
            <span>{item.q}</span>
            <span className="shrink-0 text-primary transition-transform group-open:rotate-45" aria-hidden>
              +
            </span>
          </summary>
          <div className="px-5 pb-5 text-muted">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
