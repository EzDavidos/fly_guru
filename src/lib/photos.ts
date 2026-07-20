// Загрузка фото в Supabase Storage: аватар инструктора (bucket avatars) и
// фото клиента (bucket clients, пак B).
//
// Константы жили внутри instructor/actions.ts и были продублированы в
// SettingsForm — файл с "use server" не умеет экспортировать обычные значения.
// С паком B появилось третье место, где нужны те же лимиты, поэтому вынесены
// сюда: три копии одного лимита рано или поздно разъезжаются.

// Форматы, которые умеет отдавать next/image. iPhone при таком accept сам
// конвертирует HEIC в JPEG при выборе из галереи.
export const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Чуть меньше лимита тела server actions (5 МБ в next.config.ts), чтобы
// остальные поля формы гарантированно влезли.
export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";

// Проверка файла из формы. Возвращает расширение (для пути в бакете) либо
// текст ошибки — вызывающий экшен показывает его под кнопкой.
export function checkPhoto(
  photo: File,
): { ext: string; error?: undefined } | { ext?: undefined; error: string } {
  const ext = PHOTO_TYPES[photo.type];
  if (!ext) return { error: "Фото — только JPG, PNG или WebP." };
  if (photo.size > PHOTO_MAX_BYTES) {
    return { error: "Фото больше 4 МБ. Выберите другое или сожмите." };
  }
  return { ext };
}
