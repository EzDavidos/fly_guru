-- 0012: реестр дополнительных (ручных) расходов школы.
-- Накатывается вручную через Supabase SQL Editor (как 0001–0011).
--
-- Пачка правок №3, пак E: вкладка «Расходы». Основные расходы школы —
-- Marina Beach 35%, ЗП инструктора 15%, Дэвид + Ромчик (СММ) 2% — считаются
-- на лету из сессий/абонементов и здесь НЕ хранятся. Эта таблица только для
-- прочих трат (аренда, топливо, инвентарь, реклама…), которые админ вносит
-- руками.

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  category text,
  amount bigint not null,
  comment text,
  created_by uuid references users(id),
  created_at timestamptz not null default now()
);

alter table expenses enable row level security;

-- Только админ: и чтение, и запись (как invite_tokens / subscription_adjustments).
create policy expenses_admin_all on expenses
  for all using (app_role() = 'admin') with check (app_role() = 'admin');
