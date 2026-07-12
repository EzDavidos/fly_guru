"use client";

import { useState } from "react";

// Реф-ссылка агента с кнопкой копирования. Домен берём из window.location —
// одна и та же кнопка работает на локалке, превью и проде без env-переменных.

export function CopyRefLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/r/${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Клипборд недоступен (старый браузер / http) — код виден рядом,
      // человек скопирует руками.
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="rounded-lg bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary">
        /r/{code}
      </code>
      <button
        type="button"
        onClick={copy}
        className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-primary hover:text-primary"
      >
        {copied ? "Скопировано ✓" : "Скопировать ссылку"}
      </button>
    </div>
  );
}
