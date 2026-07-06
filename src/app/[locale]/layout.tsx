import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import "../globals.css";

export const metadata: Metadata = {
  title: "FlyGuru",
  description: "Школа электрофойлов в Нячанге",
};

// Заранее генерируем страницы для всех локалей (статическая оптимизация).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Если в URL пришёл неизвестный язык — 404.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Фиксируем локаль для статического рендера этого запроса.
  setRequestLocale(locale);

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* Провайдер отдаёт сообщения клиентским компонентам */}
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
