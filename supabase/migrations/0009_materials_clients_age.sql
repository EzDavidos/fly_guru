-- 0009: справочник рекламных материалов + возраст клиента.
-- Накатывается вручную через Supabase SQL Editor (как 0001–0008).

-- ── materials ────────────────────────────────────────────────────────────────
-- Каналы-метки для /admin/materials. Ссылка вида /?src=<код> приклеивается
-- к гостю на 30 дней (lib/attribution.ts) и приходит вместе с его заявкой —
-- канал видно в админке. Раньше список был захардкожен в странице; теперь
-- админ добавляет/правит каналы сам.
create table materials (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,                 -- «Instagram», «Баннер на пляже»…
  hint       text,                          -- подсказка, где использовать
  src        text not null unique,          -- метка в ссылке: /?src=<src>
  created_at timestamptz not null default now()
);

alter table materials enable row level security;

-- Страница админская; удаление безопасно — bookings.src хранит метку текстом,
-- FK на materials нет, история заявок не трогается.
create policy materials_admin_all on materials
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- Стартовый набор — те же четыре канала, что были захардкожены.
insert into materials (label, hint, src) values
  ('Instagram',  'в шапку профиля и в сторис',                'instagram'),
  ('QR-код',     'зашить в QR на стойке или баннере',         'qr'),
  ('Флаер',      'печатные листовки и визитки',               'flyer'),
  ('Партнёр',    'отели, кафе, прокаты без личного реф-кода', 'partner');

-- ── clients.age ──────────────────────────────────────────────────────────────
-- Возраст клиента: правится в карточке админки, нужен для сортировки базы.
alter table clients add column if not exists age int;
