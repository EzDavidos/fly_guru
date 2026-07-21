-- 0019: открытие/закрытие смены, инвентарь и фотофиксация.
-- Накатывается вручную через Supabase SQL Editor (как 0001–0018).
--
-- Пачка правок №4, пак C (пункт 5).
--
-- Что было: shifts (0014) — это ПЛАН. Админ заранее отмечает, кто работает в
-- какой день. Факта не было вообще: во сколько человек реально вышел, в каком
-- состоянии принял доски и когда закрылся — нигде не хранилось. Поэтому при
-- поломке нельзя было понять, на чьей смене она случилась.
--
-- Что добавляем: тот же shifts обрастает фактом (opened_at/closed_at и
-- комментарии), появляется справочник инвентаря и фотографии на открытии и
-- закрытии смены.
--
-- Почему факт живёт в shifts, а не в отдельной таблице: смена у инструктора
-- за день ровно одна (unique instructor_id+date из 0014), и разделение
-- «план тут, факт там» заставило бы каждый экран джойнить две таблицы ради
-- одной строки.

-- ── shifts: факт выхода ──────────────────────────────────────────────────────
alter table shifts add column if not exists opened_at    timestamptz;
alter table shifts add column if not exists closed_at    timestamptz;
alter table shifts add column if not exists open_comment  text;
alter table shifts add column if not exists close_comment text;

-- Смену может завести не только админ: если инструктор вышел в день, который
-- не планировали, он открывает смену сам, а она создаётся на лету. Признак
-- нужен, чтобы босс отличал такие выходы от согласованных.
alter table shifts add column if not exists planned boolean not null default true;

-- ── Справочник инвентаря ─────────────────────────────────────────────────────
-- Доски и крылья поштучно: фото привязывается к конкретной единице, иначе по
-- снимку не понять, какая доска сломана. Наполняет админ в Настройках.
create table equipment (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('board', 'wing')),
  name       text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (kind, name)
);

alter table equipment enable row level security;

-- Читают оба (инструктору нужен список при съёмке), ведёт только админ.
create policy equipment_select_staff on equipment
  for select to authenticated
  using (app_role() in ('instructor', 'admin'));

create policy equipment_admin_all on equipment
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- ── Фотографии смены ─────────────────────────────────────────────────────────
-- phase — открытие или закрытие: сравнивая пары, видно, что изменилось за день.
-- kind:
--   board / wing  — обязательные снимки, привязаны к единице инвентаря;
--   comms         — комплект связи, необязателен;
--   extra         — свободные снимки (уже имеющиеся дефекты), сколько угодно.
create table shift_photos (
  id           uuid primary key default gen_random_uuid(),
  shift_id     uuid not null references shifts(id) on delete cascade,
  phase        text not null check (phase in ('open', 'close')),
  kind         text not null check (kind in ('board', 'wing', 'comms', 'extra')),
  equipment_id uuid references equipment(id) on delete set null,
  path         text not null,          -- путь внутри бакета shifts
  url          text not null,          -- публичная ссылка (готовая для next/image)
  created_by   uuid references users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index shift_photos_shift_idx on shift_photos (shift_id);
-- Чистилка ходит по возрасту — индекс по дате её и обслуживает.
create index shift_photos_created_idx on shift_photos (created_at);

alter table shift_photos enable row level security;

-- Смотрят оба: инструктору нужно видеть, что он уже снял, админу — всё.
create policy shift_photos_select_staff on shift_photos
  for select to authenticated
  using (app_role() in ('instructor', 'admin'));

-- Загружает инструктор только к СВОЕЙ смене: shift_id должен указывать на
-- смену, где instructor_id — он сам. Без этой проверки можно было бы подшить
-- свои фото к чужому дню.
create policy shift_photos_insert_own on shift_photos
  for insert to authenticated
  with check (
    app_role() = 'instructor'
    and created_by = app_user_id()
    and exists (
      select 1 from shifts s
      where s.id = shift_id and s.instructor_id = app_user_id()
    )
  );

-- Убрать можно только свой кадр (смазал доску — переснял). Ограничение «пока
-- смена не закрыта» держит код экшена, а не RLS: политике достаточно проверки
-- владельца.
create policy shift_photos_delete_own on shift_photos
  for delete to authenticated
  using (
    app_role() = 'instructor'
    and exists (
      select 1 from shifts s
      where s.id = shift_id and s.instructor_id = app_user_id()
    )
  );

create policy shift_photos_admin_all on shift_photos
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- ── shifts: инструктор открывает и закрывает свою смену ──────────────────────
-- В 0014 писать в shifts мог только админ (shifts_admin_all). Теперь инструктор
-- заводит себе смену (незапланированный выход) и правит СВОЮ строку — но
-- только свою и только как instructor_id = он сам.
create policy shifts_insert_own on shifts
  for insert to authenticated
  with check (app_role() = 'instructor' and instructor_id = app_user_id());

create policy shifts_update_own on shifts
  for update to authenticated
  using (app_role() = 'instructor' and instructor_id = app_user_id())
  with check (app_role() = 'instructor' and instructor_id = app_user_id());

-- ── Бакет для фото смен ──────────────────────────────────────────────────────
-- Публичный, как avatars и clients: пути содержат uuid смены, снаружи их не
-- угадать, а next/image отдаёт публичные ссылки без возни с подписями. Живут
-- эти фото всё равно недолго — чистилка сносит их через 3 дня
-- (/api/cron/cleanup-shift-photos).
insert into storage.buckets (id, name, public)
values ('shifts', 'shifts', true)
on conflict (id) do nothing;
