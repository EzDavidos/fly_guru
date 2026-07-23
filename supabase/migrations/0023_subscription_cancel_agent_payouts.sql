-- 0023: отмена абонемента + выплаты агентам.
-- Накатывается вручную через Supabase SQL Editor (как 0001–0022).
--
-- Пачка правок №5, этап 3:
--  • №13 — у абонементов появляются вкладки «Архив» (срок вышел / минуты
--    откатаны) и «Отменённые». Архив считается по уже существующим статусам
--    (expired, used_up), а вот отмены раньше не было вовсе: абонемент можно
--    было только удалить насовсем, вместе с историей списаний.
--  • №7 — админ отмечает, что выплатил агенту деньги: сумма, способ, дата.
--    Раньше в базе был только факт НАЧИСЛЕНИЯ награды (referral_rewards),
--    а «отдал ли я эти деньги» школа держала в голове.

-- ── Статус «отменён» для абонемента ──────────────────────────────────────────
-- if not exists — чтобы повторный прогон миграции не падал. Новое значение
-- ниже по скрипту НЕ используется: Postgres не разрешает применять только что
-- добавленное значение enum в той же транзакции.
alter type subscription_status add value if not exists 'cancelled';

-- ── Выплаты агентам ──────────────────────────────────────────────────────────
-- Одна строка = один факт «отдал агенту деньги». Сумма не привязана к
-- конкретным наградам: админ может закрыть три награды одним переводом или
-- выплатить частями. «К выплате» = подтверждённые награды − сумма выплат.
--
-- method_id — тот же справочник форматов оплаты, что у сессий и расходов
-- (наличные / QR / перевод), чтобы не плодить второй список.
create table if not exists agent_payouts (
  id         uuid primary key default gen_random_uuid(),
  agent_id   uuid not null references agents(id) on delete cascade,
  amount     bigint not null,
  method_id  uuid references payment_methods(id),
  paid_on    date not null,
  comment    text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists agent_payouts_agent_idx on agent_payouts (agent_id);

alter table agent_payouts enable row level security;

-- Деньги агентов — дело админа: инструктор их не видит и не трогает.
drop policy if exists agent_payouts_admin_all on agent_payouts;
create policy agent_payouts_admin_all on agent_payouts
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');
