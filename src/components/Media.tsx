import Image from "next/image";

// Обёртка next/image для плейсхолдеров.
// Реальное фото подставляется заменой `src` на путь к JPG/PNG (или удалением
// этого компонента в пользу обычного <Image>). Размеры фиксируют место под
// картинку → нет сдвига верстки (важно для Lighthouse).
export function Media({
  ratio = "16/9",
  className = "",
  sizes = "100vw",
  priority = false,
  rounded = "rounded-2xl",
  alt = "FlyGuru — плейсхолдер фото",
}: {
  ratio?: "16/9" | "4/3" | "1/1" | "3/4";
  className?: string;
  sizes?: string;
  priority?: boolean;
  rounded?: string;
  alt?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-surface-2 ${rounded} ${className}`}
      style={{ aspectRatio: ratio.replace("/", " / ") }}
    >
      {/* TODO: заменить src на реальное фото */}
      <Image
        src="/placeholders/media.svg"
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
