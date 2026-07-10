-- ============================================================================
-- FlyGuru — Этап 3: роли и RLS-политики
-- Источник правды: docs/flyguru_architecture.md, разделы 5–6.
--
-- До этой миграции на всех таблицах был включён RLS без политик (deny-all),
-- и весь доступ шёл через service_role (сервер). Теперь появляются
-- залогиненные пользователи (роль в auth: authenticated), и мы описываем,
-- кому что можно. Принципы:
--   - роль приложения лежит в JWT (app_metadata.role) И в users.role;
--     JWT — для быстрых проверок, users — источник правды;
--   - инструктор может СОЗДАВАТЬ записи (clients/sessions/subscriptions),
--     но видит только свои сессии, а не всю CRM;
--   - публичные формы (bookings, ref_visits, product_requests) пишутся
--     через service_role в API-роутах — политик для anon НЕТ намеренно;
--   - admin — полный доступ везде.
-- ============================================================================

-- ── Хелперы ──────────────────────────────────────────────────────────────────

-- id пользователя приложения (users.id) по текущему auth-пользователю.
-- security definer: функция должна читать users в обход RLS самой users.
create or replace function public.app_user_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from users where auth_id = auth.uid()
$$;

-- Роль приложения из JWT (app_metadata.role). Пустая строка, если нет.
create or replace function public.app_role()
returns text
language sql stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '')
$$;

grant execute on function public.app_user_id() to authenticated;
grant execute on function public.app_role() to authenticated;

-- ── users ────────────────────────────────────────────────────────────────────
-- Каждый видит свою строку (нужно кабинетам, чтобы узнать «кто я»).
create policy users_select_own on users
  for select to authenticated
  using (auth_id = auth.uid() or app_role() = 'admin');

create policy users_admin_all on users
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- ── services ─────────────────────────────────────────────────────────────────
-- Справочник услуг не секретен (он и так на сайте) — читают все залогиненные.
create policy services_select_authenticated on services
  for select to authenticated
  using (true);

create policy services_admin_all on services
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- ── clients ──────────────────────────────────────────────────────────────────
-- Инструктору нужны все клиенты: найти по телефону перед записью/списанием.
create policy clients_select_staff on clients
  for select to authenticated
  using (app_role() in ('instructor', 'admin'));

-- Создавать клиентов может инструктор, но только «от своего имени».
create policy clients_insert_instructor on clients
  for insert to authenticated
  with check (app_role() = 'instructor' and created_by = app_user_id());

create policy clients_admin_all on clients
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- ── bookings ─────────────────────────────────────────────────────────────────
-- Инструктор видит заявки (экран «Заявки на сегодня») и может двигать статус
-- (оформил клиента по заявке → done). Вставка заявок — только service_role.
create policy bookings_select_staff on bookings
  for select to authenticated
  using (app_role() in ('instructor', 'admin'));

create policy bookings_update_staff on bookings
  for update to authenticated
  using (app_role() in ('instructor', 'admin'))
  with check (app_role() in ('instructor', 'admin'));

create policy bookings_admin_all on bookings
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- ── sessions ─────────────────────────────────────────────────────────────────
-- Инструктор создаёт сессии только на себя (instructor_id подставляет сервер,
-- а политика гарантирует, что подделать чужой id нельзя).
create policy sessions_insert_instructor on sessions
  for insert to authenticated
  with check (
    app_role() = 'instructor'
    and instructor_id = app_user_id()
    and created_by = app_user_id()
  );

-- Инструктор видит СВОИ сессии (статистика) + все списания с абонементов
-- (sessions с subscription_id): без них не посчитать остаток минут клиента,
-- который катался и у других инструкторов. Списания не чувствительны — amount = 0.
create policy sessions_select_instructor on sessions
  for select to authenticated
  using (
    app_role() = 'instructor'
    and (instructor_id = app_user_id() or subscription_id is not null)
  );

create policy sessions_admin_all on sessions
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- ── subscriptions ────────────────────────────────────────────────────────────
-- Остатки абонементов всех клиентов нужны инструктору для списания.
create policy subscriptions_select_staff on subscriptions
  for select to authenticated
  using (app_role() in ('instructor', 'admin'));

create policy subscriptions_insert_instructor on subscriptions
  for insert to authenticated
  with check (app_role() = 'instructor' and sold_by = app_user_id());

-- Update нужен инструктору, чтобы пометить абонемент used_up после списания
-- последних минут (пометка статуса, не финансовые поля — админка это правит
-- на этапе 4 при необходимости).
create policy subscriptions_update_instructor on subscriptions
  for update to authenticated
  using (app_role() = 'instructor')
  with check (app_role() = 'instructor');

create policy subscriptions_admin_all on subscriptions
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- ── memberships ──────────────────────────────────────────────────────────────
-- Продажа первого абонемента создаёт членство.
create policy memberships_select_staff on memberships
  for select to authenticated
  using (app_role() in ('instructor', 'admin'));

create policy memberships_insert_instructor on memberships
  for insert to authenticated
  with check (app_role() = 'instructor');

create policy memberships_admin_all on memberships
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- ── agents ───────────────────────────────────────────────────────────────────
-- Инструктору нужно резолвить ref_code заявки → агент (для награды и атрибуции).
create policy agents_select_staff on agents
  for select to authenticated
  using (app_role() in ('instructor', 'admin'));

create policy agents_admin_all on agents
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- ── referral_rewards ─────────────────────────────────────────────────────────
-- Награда создаётся в момент оформления клиента по реф-заявке (pending).
create policy rewards_insert_instructor on referral_rewards
  for insert to authenticated
  with check (app_role() = 'instructor');

create policy rewards_admin_all on referral_rewards
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- ── Только админ (кабинеты/этапы дальше) ─────────────────────────────────────
create policy products_admin_all on products
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

create policy product_requests_admin_all on product_requests
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

create policy ref_visits_admin_all on ref_visits
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

-- member/agent: политики «читать своё» появятся на этапе 5 вместе с кабинетами —
-- сейчас у этих ролей нет ни одного экрана, поэтому и доступа нет (deny-all).
