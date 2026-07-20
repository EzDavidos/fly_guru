-- 0016: справочники (категории расходов, форматы оплаты) + расходы инструктора.
-- Накатывается вручную через Supabase SQL Editor (как 0001–0015).
--
-- Пачка правок №4, пак A (пункты 3, 4, 6):
--  • #4 — категории расходов перестают быть свободным текстом: админ ведёт
--    справочник, форма выбирает из него.
--  • #6 — формат оплаты (QR, T-Bank, наличные…) тоже справочник админа;
--    обязателен в сессии, необязателен в заявке.
--  • #3 — инструктор получает свою вкладку «Расходы»: вносит и видит ТОЛЬКО
--    свои, админ видит все (они уже падают в «Дополнительные расходы»).

-- ── Справочник: категории расходов ───────────────────────────────────────────
-- active вместо удаления: категорию, на которую уже ссылаются старые расходы,
-- нельзя просто снести — прячем из выпадашки, история остаётся читаемой.
create table expense_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Справочник: форматы оплаты ───────────────────────────────────────────────
create table payment_methods (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- Стартовый набор — чтобы форма сессии не встретила инструктора пустым списком
-- (поле обязательное). Лишнее админ спрячет, своё добавит.
insert into payment_methods (name) values
  ('Наличные'),
  ('QR'),
  ('T-Bank'),
  ('Перевод')
on conflict (name) do nothing;

-- ── expenses: текстовая категория → ссылка на справочник ─────────────────────
alter table expenses add column category_id uuid references expense_categories(id);

-- Переносим то, что уже наели руками: каждое непустое значение category
-- становится категорией справочника, расход — ссылкой на неё.
insert into expense_categories (name)
select distinct trim(category)
from expenses
where category is not null and trim(category) <> ''
on conflict (name) do nothing;

update expenses e
set category_id = c.id
from expense_categories c
where c.name = trim(e.category);

-- Старую колонку НЕ удаляем: если что-то пошло не так, история под рукой.
-- Читать её код больше не будет.
comment on column expenses.category is
  'Устарело с 0016 — категория живёт в category_id. Оставлено как страховка.';

-- ── expenses: RLS для инструктора ────────────────────────────────────────────
-- Политика expenses_admin_all из 0012 остаётся: админ по-прежнему видит и
-- правит всё. Инструктору даём ровно свои строки — ни чужих сумм, ни удаления
-- задним числом чужого расхода.
create policy expenses_instructor_select_own on expenses
  for select to authenticated
  using (app_role() = 'instructor' and created_by = app_user_id());

create policy expenses_instructor_insert_own on expenses
  for insert to authenticated
  with check (app_role() = 'instructor' and created_by = app_user_id());

create policy expenses_instructor_delete_own on expenses
  for delete to authenticated
  using (app_role() = 'instructor' and created_by = app_user_id());

-- ── Формат оплаты в сессиях и заявках ────────────────────────────────────────
-- Обе колонки nullable на уровне БД намеренно: обязательность в сессии — это
-- правило формы, а не схемы. Иначе исторические сессии (их уже завели) стали
-- бы невалидными, и любая миграция данных упиралась бы в not null.
alter table sessions add column payment_method_id uuid references payment_methods(id);
alter table bookings add column payment_method_id uuid references payment_methods(id);

-- ── RLS справочников ─────────────────────────────────────────────────────────
alter table expense_categories enable row level security;
alter table payment_methods enable row level security;

-- Читают оба (инструктору нужны обе выпадашки), ведёт только админ.
create policy expense_categories_select_staff on expense_categories
  for select to authenticated
  using (app_role() in ('instructor', 'admin'));

create policy expense_categories_admin_all on expense_categories
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');

create policy payment_methods_select_staff on payment_methods
  for select to authenticated
  using (app_role() in ('instructor', 'admin'));

create policy payment_methods_admin_all on payment_methods
  for all to authenticated
  using (app_role() = 'admin') with check (app_role() = 'admin');
