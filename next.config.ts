import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Оборачиваем конфиг плагином next-intl: он подключает src/i18n/request.ts
// и включает поддержку сообщений/локалей на уровне сборки.
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  experimental: {
    // Загрузка аватарки в настройках кабинета идёт через server action;
    // дефолтный лимит тела (1 МБ) для фото с телефона мал.
    serverActions: { bodySizeLimit: "5mb" },
  },
  images: {
    // Next 16 отдаёт только те значения quality, что перечислены здесь.
    // 90 — для фото на воде: на 75 небо и брызги заметно рассыпаются.
    qualities: [75, 90],
    // Разрешаем next/image отдавать SVG — используется для локальных
    // плейсхолдеров в /public/placeholders. Источник доверенный (наш репозиторий).
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // Аватарки инструкторов и фото клиентов лежат в публичных бакетах
    // Supabase Storage. Перечисляем бакеты поимённо, а не /public/** целиком:
    // так новый бакет не начнёт раздаваться через наш домен по недосмотру.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/avatars/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/clients/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
