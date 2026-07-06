import { defineRouting } from "next-intl/routing";

// Единое место конфигурации языков.
// localePrefix: "as-needed" — у дефолтного языка (ru) URL без префикса (/training),
// у остальных языков префикс добавляется (/en/training, /vi/training).
export const routing = defineRouting({
  locales: ["ru", "en", "vi"],
  defaultLocale: "ru",
  localePrefix: "as-needed",
});
