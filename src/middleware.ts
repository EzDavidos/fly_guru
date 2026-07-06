import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Middleware next-intl: разбирает язык из URL, при необходимости редиректит
// и переписывает путь на внутренний сегмент [locale].
export default createMiddleware(routing);

export const config = {
  // Прогоняем через middleware всё, кроме служебных путей Next и файлов с расширением.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
