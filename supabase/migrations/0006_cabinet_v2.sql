-- ============================================================================
-- FlyGuru — Этап 3.5: кабинет инструктора v2 + приём заявок в админке
-- Задание: prompts/prompt_intructor.txt (утверждено 2026-07-10).
--
-- Поток: заявка с сайта (new) → админ вносит время/возраст/вес и подтверждает
-- (confirmed) → «запись» видна всем инструкторам → любой принимает
-- (accepted_by) → оформляет занятие (существующий флоу закрывает в done).
-- ============================================================================

-- ── users: профиль инструктора ───────────────────────────────────────────────
-- Настройки кабинета: отображаемое имя (name уже есть), фото, возраст,
-- личная цель по ЗП на месяц (для прогресс-бара на главном экране).
alter table users add column if not exists photo_url    text;
alter table users add column if not exists age          integer;
alter table users add column if not exists monthly_goal bigint;

-- ── bookings: заявка дорастает до «записи» ───────────────────────────────────
-- Эти поля заполняет админ при созвоне с клиентом. scheduled_time — свободный
-- текст («10:30», «после обеда»): жёсткий тип time только мешал бы.
alter table bookings add column if not exists scheduled_time text;
alter table bookings add column if not exists age            integer;
alter table bookings add column if not exists weight         integer;

-- Закреп: админ помечает срочные записи, они висят сверху списка у инструкторов.
alter table bookings add column if not exists pinned boolean not null default false;

-- Кто из инструкторов принял запись (и когда). Пока null — запись «активная»:
-- считается в красных кружочках (кнопка «Записи», кнопка «Кабинет» в шапке).
alter table bookings add column if not exists accepted_by uuid references users(id) on delete set null;
alter table bookings add column if not exists accepted_at timestamptz;

-- ── storage: аватарки инструкторов ───────────────────────────────────────────
-- Публичный бакет: чтение по прямой ссылке, запись только через service_role
-- на сервере (политик для authenticated намеренно нет).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
