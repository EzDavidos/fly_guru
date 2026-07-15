-- 0014: смены (выходы) инструкторов — пак H1.
-- Накатывается вручную через Supabase SQL Editor (как 0001–0013).
--
-- Смена = «этот инструктор работает в этот день» (+ необязательная заметка).
-- Ставит смену АДМИН (планирует наперёд), видят оба (админ и инструктор).
-- В паке H2 число смен за месяц пойдёт в ЗП: 200 000 ₫ × число выходов.
-- Времени у смены нет намеренно — время занятия живёт в заявке (scheduled_time).

create table shifts (
  id            uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references users(id) on delete cascade,
  date          date not null,
  note          text,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (instructor_id, date)          -- один инструктор — одна смена в день
);

alter table shifts enable row level security;

-- Смотрят оба (staff), ставит/снимает только админ.
create policy shifts_select_staff on shifts
  for select to authenticated
  using (app_role() in ('instructor', 'admin'));

create policy shifts_admin_all on shifts
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');
