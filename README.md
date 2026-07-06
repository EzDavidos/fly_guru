# FlyGuru

Сайт-экосистема школы электрофойлов в Нячанге (Вьетнам): обучение, клубная система,
магазин фойлов, рефералы и CRM.

**Источник правды по проекту** — [`docs/flyguru_architecture.md`](docs/flyguru_architecture.md).
Разработка идёт по этапам из раздела 10 того документа. Текущий статус: **Этап 0** (сетап).

## Стек

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **Supabase** (Postgres, Auth, RLS)
- **next-intl** — i18n (ru по умолчанию, en/vi — каркас)
- Деплой: **Vercel**, домен на timeweb → DNS на Vercel

## Структура проекта

```
src/
  app/[locale]/        публичные страницы (сегмент [locale] — язык из URL)
  i18n/                конфигурация next-intl (routing, request, navigation)
  lib/supabase/        клиенты Supabase (client.ts — браузер, server.ts — сервер)
  middleware.ts        роутинг локалей
messages/              переводы: ru.json (контент), en.json, vi.json (каркас)
supabase/
  migrations/          SQL-миграции схемы БД
  seed.sql             сиды (справочник услуг)
docs/                  архитектурный документ
```

## Локальный запуск

1. Установить зависимости:
   ```bash
   npm install
   ```
2. Создать `.env.local` из шаблона и заполнить ключами Supabase:
   ```bash
   cp .env.example .env.local
   ```
   Где брать значения — см. комментарии в `.env.example` (дашборд Supabase →
   Project Settings → Data API / API Keys).
3. Запустить дев-сервер:
   ```bash
   npm run dev
   ```
   Открыть http://localhost:3000

Прочие команды: `npm run build` (прод-сборка), `npm run start` (запуск сборки),
`npm run lint`.

## Роутинг локалей

`localePrefix: "as-needed"` (см. `src/i18n/routing.ts`):
- `ru` (по умолчанию) — **без префикса**: `/`, `/training`, `/club`
- `en` / `vi` — **с префиксом**: `/en/training`, `/vi/club`

## База данных: миграции и сиды

Схема лежит в `supabase/migrations/`, сиды услуг — в `supabase/seed.sql`.
Два способа накатить на чистый проект Supabase.

### Вариант A — Supabase CLI (рекомендуется)

CLI глобально ставить не нужно, запускаем через `npx`.

```bash
# 1. Логин (откроет браузер)
npx supabase login

# 2. Привязать локальную папку к своему проекту (project ref — в URL дашборда)
npx supabase link --project-ref <your-project-ref>

# 3. Накатить миграции из supabase/migrations
npx supabase db push

# 4. Залить сиды
npx supabase db push --include-seed
# либо выполнить seed вручную:
#   psql "<connection-string>" -f supabase/seed.sql
```

> `supabase db reset` пересоздаёт БД и автоматически прогоняет миграции + `seed.sql`.
> На удалённом проекте это **стирает данные** — использовать осознанно.

### Вариант B — вручную через дашборд

Dashboard → **SQL Editor** → New query:
1. Вставить содержимое `supabase/migrations/0001_init.sql` → Run.
2. Вставить содержимое `supabase/seed.sql` → Run.

### Проверка

Dashboard → **Table Editor** → таблица `services`: должно быть **11 услуг** с ценами
из раздела 3 архитектуры (у «Путешествия» цена пустая — TBD).

> RLS включён на всех таблицах без политик (deny-all). Клиентские ключи пока
> ничего не видят — это ожидаемо, политики появятся на Этапе 3.

## Деплой на Vercel

1. Запушить репозиторий на GitHub.
2. https://vercel.com/new → **Import** этот репозиторий. Vercel сам определит Next.js.
3. В **Environment Variables** добавить те же ключи, что в `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. **Deploy**. После сборки проект открывается по адресу `https://<project>.vercel.app`.

Дальнейшие пуши в основную ветку деплоятся автоматически.

## Домен с timeweb → Vercel

Домен остаётся зарегистрированным на timeweb, меняем только DNS-записи, чтобы
трафик шёл на Vercel.

1. В Vercel: проект → **Settings → Domains** → добавить свой домен (напр. `flyguru.ru`).
   Vercel покажет нужные записи.
2. В панели timeweb (**Домены и поддомены → DNS-записи**) прописать:

   | Тип   | Имя (host) | Значение                | Назначение              |
   |-------|------------|-------------------------|-------------------------|
   | A     | `@`        | `76.76.21.21`           | корневой домен → Vercel |
   | CNAME | `www`      | `cname.vercel-dns.com`  | поддомен www → Vercel   |

   > Точные значения всегда сверяй с тем, что показывает Vercel в Settings → Domains —
   > он может дать другой A-адрес или запросить проверочную запись.
3. Удалить старые A/CNAME-записи timeweb, конфликтующие с `@` и `www`.
4. Подождать распространение DNS (от минут до нескольких часов). Vercel сам выпустит
   TLS-сертификат, когда увидит корректные записи.

> План Б (резерв): VPS timeweb `194.87.220.7` на случай проблем доступности из РФ —
> в Этапе 0 не задействуется.
