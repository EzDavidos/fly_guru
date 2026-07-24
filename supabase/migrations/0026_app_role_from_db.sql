-- 0026: app_role() читает роль из БД, а не из JWT.
-- Накатывается вручную через Supabase SQL Editor (как 0001–0025).
--
-- Проблема. Роль в FlyGuru лежит в ДВУХ местах: в JWT (app_metadata.role) и в
-- users.role (источник правды). Приложение (middleware, login, getAppUser) уже
-- давно судит по БД — потому что JWT отстаёт, если роль сменили после выдачи
-- токена. А вот RLS всё это время судил по JWT: политики users_*/agents_* и др.
-- завязаны на app_role(), а та читала app_metadata.role из токена.
--
-- Из-за рассинхрона получалось так: приложение пускает человека в админку (в БД
-- он admin), но Postgres при проверке RLS видит в его старом JWT другую роль и
-- молча не отдаёт чужие строки. Симптом: в ленте заявок реф-код не резолвился
-- («владелец не найден»), хотя в Telegram (там ходим service_role, мимо RLS) имя
-- владельца находилось. Тем же путём пропадала бы и колонка «кто принял заявку».
--
-- Фикс. Переводим app_role() на чтение users.role — тот же источник, что у
-- приложения, и тот же приём, что уже применён в app_user_id(): security definer
-- (функция читает users в обход RLS самой users) + фиксированный search_path.
-- Теперь RLS и приложение всегда судят по БД, и JWT-рассинхрон больше ничего не
-- ломает. Пустая строка, если строки в users нет (как и раньше).

create or replace function public.app_role()
returns text
language sql stable security definer
set search_path = public
as $$
  -- role — это enum user_role, поэтому приводим к тексту: иначе coalesce
  -- пытается подставить '' как значение енама и падает (22P02). Вызывающий код
  -- всё равно сравнивает роль как строку ('admin'/'instructor').
  select coalesce((select role::text from users where auth_id = auth.uid()), '')
$$;

grant execute on function public.app_role() to authenticated;
