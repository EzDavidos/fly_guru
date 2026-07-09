import Image from "next/image";

// Обёртка next/image. Размеры фиксируют место под картинку → нет сдвига
// вёрстки (важно для Lighthouse). Без `src` показывает серый плейсхолдер.
export function Media({
  src = "/placeholders/media.svg",
  ratio = "16/9",
  className = "",
  sizes = "100vw",
  priority = false,
  rounded = "rounded-2xl",
  alt = "FlyGuru — плейсхолдер фото",
}: {
  src?: string;
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
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}

// Зацикленное видео без звука. Играет само, как «живое фото».
// poster показывается, пока видео грузится, и на мобильных при экономии трафика.
export function VideoLoop({
  src,
  poster,
  ratio = "16/9",
  className = "",
  rounded = "rounded-2xl",
  // Для видео на первом экране: грузим сразу, иначе — по мере прокрутки.
  priority = false,
}: {
  src: string;
  poster: string;
  ratio?: "16/9" | "4/3" | "1/1" | "3/4";
  className?: string;
  rounded?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-surface-2 ${rounded} ${className}`}
      style={{ aspectRatio: ratio.replace("/", " / ") }}
    >
      <video
        src={src}
        poster={poster}
        autoPlay
        loop
        muted
        playsInline
        preload={priority ? "auto" : "none"}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}

// Видео с кнопкой play — для длинных роликов, которые не крутим фоном.
export function VideoPlayer({
  src,
  poster,
  ratio = "16/9",
  className = "",
  rounded = "rounded-2xl",
}: {
  src: string;
  poster: string;
  ratio?: "16/9" | "4/3" | "1/1" | "3/4";
  className?: string;
  rounded?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden bg-surface-2 ${rounded} ${className}`}
      style={{ aspectRatio: ratio.replace("/", " / ") }}
    >
      <video
        src={src}
        poster={poster}
        controls
        playsInline
        preload="none"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
