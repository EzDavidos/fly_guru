-- ============================================================================
-- FlyGuru — начальная схема БД (Этап 0)
-- Источник правды: docs/flyguru_architecture.md, раздел 6.
-- RLS-политики здесь НЕ описываются: на всех таблицах включён RLS без политик,
-- что означает deny-all для ролей anon/authenticated. Политики — Этап 3.
-- (service_role обходит RLS — используется миграциями/сидами/сервером.)
-- ============================================================================

-- gen_random_uuid() входит в расширение pgcrypto (в Supabase обычно включено).
create extension if not exists pgcrypto;

-- ── ENUM-типы ────────────────────────────────────────────────────────────────
create type user_role           as enum ('admin', 'instructor', 'member', 'agent');
create type service_category    as enum ('training', 'tandem', 'rental', 'tour', 'subscription', 'extra');
create type booking_status      as enum ('new', 'confirmed', 'done', 'cancelled');
create type subscription_status as enum ('active', 'expired', 'used_up');
create type client_source       as enum ('agent', 'member', 'site', 'offline');
create type referrer_type       as enum ('agent', 'member');
create type reward_type         as enum ('money', 'minutes');
create type reward_status       as enum ('pending', 'confirmed');
create type membership_level    as enum ('member', 'rider', 'legend');

-- ── users ────────────────────────────────────────────────────────────────────
-- Пользователи всех ролей. auth_id связывает с Supabase Auth (auth.users.id);
-- FK намеренно не ставим, чтобы миграция не зависела от auth-схемы.
create table users (
  id       uuid primary key default gen_random_uuid(),
  role     user_role not null,
  name     text not null,
  phone    text,
  email    text,
  auth_id  uuid unique
);

-- ── agents ───────────────────────────────────────────────────────────────────
create table agents (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references users(id) on delete cascade,
  ref_code         text not null unique,
  commission_fixed bigint not null default 300000,   -- 300 000 ₫ за клиента
  active           boolean not null default true
);

-- ── clients ──────────────────────────────────────────────────────────────────
-- referrer_id — полиморфная ссылка (agent или member), тип в referrer_type. Без FK.
create table clients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text,
  source        client_source not null,
  referrer_type referrer_type,
  referrer_id   uuid,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ── services ─────────────────────────────────────────────────────────────────
-- duration_min / price допускают NULL: часть услуг измеряется «днём», часть — TBD.
create table services (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  duration_min integer,
  price        bigint,
  category     service_category not null,
  active       boolean not null default true
);

-- ── subscriptions ────────────────────────────────────────────────────────────
-- Остаток минут = total_minutes − SUM(sessions.minutes_used). expires_at — TBD (+6 мес).
create table subscriptions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references clients(id) on delete cascade,
  total_minutes integer not null default 300,
  price         bigint not null default 6000000,     -- 6 000 000 ₫
  sold_by       uuid references users(id) on delete set null,
  sold_at       timestamptz not null default now(),
  expires_at    timestamptz,
  status        subscription_status not null default 'active'
);

-- ── bookings ─────────────────────────────────────────────────────────────────
-- Заявки с сайта. client_id заполняется после сопоставления с клиентом.
create table bookings (
  id             uuid primary key default gen_random_uuid(),
  client_name    text not null,
  phone          text not null,
  service_id     uuid references services(id) on delete set null,
  preferred_date date,
  ref_code       text,
  status         booking_status not null default 'new',
  created_at     timestamptz not null default now(),
  client_id      uuid references clients(id) on delete set null
);

-- ── sessions ─────────────────────────────────────────────────────────────────
-- Проведённая каталка/занятие. Для списаний с абонемента: minutes_used > 0,
-- amount = 0, subscription_id заполнен. Для обычной сессии: amount = чек.
create table sessions (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid references clients(id) on delete set null,
  service_id      uuid references services(id) on delete set null,
  instructor_id   uuid references users(id) on delete set null,
  date            date not null,
  minutes_used    integer,
  amount          bigint not null default 0,
  subscription_id uuid references subscriptions(id) on delete set null,
  created_by      uuid references users(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ── referral_rewards ─────────────────────────────────────────────────────────
-- referrer_id — полиморфная ссылка (agent/member), тип в referrer_type. Без FK.
create table referral_rewards (
  id            uuid primary key default gen_random_uuid(),
  referrer_type referrer_type not null,
  referrer_id   uuid not null,
  client_id     uuid references clients(id) on delete set null,
  reward_type   reward_type not null,
  amount        bigint not null,
  status        reward_status not null default 'pending',
  confirmed_at  timestamptz
);

-- ── memberships ──────────────────────────────────────────────────────────────
-- Активность привилегий вычисляется по наличию активного абонемента, не хранится.
create table memberships (
  id        uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references clients(id) on delete cascade,
  level     membership_level not null default 'member',
  since     timestamptz not null default now()
);

-- ── products (магазин фойлов) ────────────────────────────────────────────────
create table products (
  id     uuid primary key default gen_random_uuid(),
  name   text not null,
  brand  text,
  specs  jsonb not null default '{}'::jsonb,
  price  bigint,
  photos text[] not null default '{}',
  active boolean not null default true
);

-- ── product_requests (заявки на покупку) ─────────────────────────────────────
create table product_requests (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,
  name       text not null,
  contact    text not null,        -- телефон/мессенджер
  message    text,
  created_at timestamptz not null default now()
);

-- ── Индексы под частые выборки ───────────────────────────────────────────────
create index idx_sessions_instructor   on sessions(instructor_id);
create index idx_sessions_client       on sessions(client_id);
create index idx_sessions_subscription on sessions(subscription_id);
create index idx_subscriptions_client  on subscriptions(client_id);
create index idx_bookings_status       on bookings(status);
create index idx_clients_referrer      on clients(referrer_type, referrer_id);

-- ── RLS: включаем на всех таблицах, политик нет → deny-all ────────────────────
-- Политики добавим на Этапе 3 (см. раздел 6 архитектуры).
alter table users             enable row level security;
alter table agents            enable row level security;
alter table clients           enable row level security;
alter table services          enable row level security;
alter table subscriptions     enable row level security;
alter table bookings          enable row level security;
alter table sessions          enable row level security;
alter table referral_rewards  enable row level security;
alter table memberships       enable row level security;
alter table products          enable row level security;
alter table product_requests  enable row level security;
