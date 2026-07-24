"use client";

// Аварийный экран верхнего уровня. Ловит сбои, которые не поймал ни один
// error.tsx внутри разделов, — в первую очередь оборвавшуюся загрузку страницы
// после раскатки новой версии («This page couldn't load»): вкладка админа висит
// открытой сутками, ты пушишь релиз, и её клик по сайдбару просит кусок старого
// билда, которого на сервере уже нет. Skew Protection в Vercel лечит саму
// причину; этот экран — на случай, когда что-то всё же упало насмерть, чтобы
// вместо сырого браузерного сообщения человек видел понятный фирменный экран.
//
// global-error заменяет КОРНЕВОЙ layout, поэтому рисует свои <html>/<body>, а CSS
// приложения тут может быть не загружен — оформляем инлайном, в цветах FlyGuru
// (палитра «Sunrise Sea», см. globals.css). Кнопка делает ЖЁСТКУЮ перезагрузку,
// а не reset(): при рассинхроне билда перерисовка того же дерева снова упрётся в
// пропавший файл — помогает только заново забрать свежую версию с сервера.

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#f7fafc",
          color: "#0f2233",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "400px",
            background: "#ffffff",
            border: "1px solid #e1eaef",
            borderRadius: "16px",
            padding: "28px 24px",
            textAlign: "center",
            boxShadow: "0 8px 30px rgba(15, 34, 51, 0.08)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              margin: "0 auto 16px",
              borderRadius: "50%",
              background: "#eef4f7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "26px",
              color: "#0e8a9e",
            }}
            aria-hidden
          >
            ↻
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: "20px", fontWeight: 700 }}>
            Страница не догрузилась
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#55707f", lineHeight: 1.5 }}>
            Скорее всего, вышло обновление, пока вкладка была открыта. Обновите
            страницу — всё встанет на место.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              width: "100%",
              border: "none",
              borderRadius: "9999px",
              padding: "12px 20px",
              fontSize: "15px",
              fontWeight: 600,
              color: "#ffffff",
              background: "#ff7a1a",
              cursor: "pointer",
            }}
          >
            Обновить
          </button>
          {error.digest && (
            <p style={{ margin: "14px 0 0", fontSize: "12px", color: "#55707f" }}>
              Код ошибки: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
