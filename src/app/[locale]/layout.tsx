import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import "../globals.css";

// Self-hosted шрифт (грузится с нашего домена, без обращения к Google на клиенте).
const font = Manrope({ subsets: ["latin", "cyrillic"], variable: "--font-app" });

export const metadata: Metadata = {
  title: {
    default: "FlyGuru — школа электрофойлов в Нячанге",
    template: "%s · FlyGuru",
  },
  description:
    "Обучение полёту на электрофойле в Нячанге. 90% учеников едут уже на первом занятии.",
};

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

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${font.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
