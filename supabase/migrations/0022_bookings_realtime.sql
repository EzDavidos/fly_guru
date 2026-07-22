-- 0022: заявки в реальном времени.
-- Накатывается вручную через Supabase SQL Editor (как 0001–0021).
--
-- Пак 6 чек-листа: лента «Актуальные заявки» у админа должна обновляться сама —
-- новые заявки появляются и статусы меняются без перезагрузки страницы.
--
-- Как это работает: браузер админа подписывается на изменения таблицы bookings
-- через Supabase Realtime. Чтобы Postgres вещал эти изменения, таблицу надо
-- добавить в публикацию supabase_realtime. Доступ к событиям Realtime сверяется
-- с той же RLS-политикой на SELECT (bookings_select_staff, миграция 0005) —
-- гость ничего не получит, только залогиненный персонал.

-- Идемпотентно: в некоторых проектах bookings уже в публикации (Realtime был
-- включён для таблицы через UI). Добавляем только если её там ещё нет —
-- повторный прогон не упадёт с «already member of publication».
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;
end $$;

-- Чтобы в событиях UPDATE/DELETE приходила строка целиком (а не только id) —
-- пригодится, если позже захотим фильтровать события на клиенте по полям.
alter table public.bookings replica identity full;
