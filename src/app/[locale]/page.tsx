import { useTranslations } from "next-intl";

// Главная. Тексты берутся из /messages/<locale>.json (namespace "Home") —
// это заодно доказывает, что каркас i18n работает end-to-end.
export default function HomePage() {
  const t = useTranslations("Home");
  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("tagline")}</p>
    </main>
  );
}
