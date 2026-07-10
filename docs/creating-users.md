# Как создать пользователей (админа, инструкторов)

Онлайн-регистрации нет: все аккаунты создаёт админ/разработчик. Два способа.

## Способ 1 — скрипт (рекомендуется)

Из корня проекта (ключи подхватываются из `.env.local`):

```bash
# Админ (вход по email)
node scripts/create-user.mjs --role admin --name "Денис" \
  --email denis@example.com --password "придумай-пароль"

# Инструктор (вход по телефону, email сгенерится технический)
node scripts/create-user.mjs --role instructor --name "Иван" \
  --phone "+84 90 123 4567" --password "придумай-пароль"

# Инструктор с настоящим email (вход и по email, и по телефону)
node scripts/create-user.mjs --role instructor --name "Пётр" \
  --email petr@example.com --phone "+84 91 234 5678" --password "пароль"
```

Скрипт делает сразу два шага: аккаунт в Supabase Auth (с ролью в JWT)
и строку в таблице `users`. После этого человек заходит на `/login`.

## Способ 2 — руками через Supabase-дашборд

1. **Authentication → Users → Add user → Create new user.**
   Email, пароль, галочка Auto Confirm User.
2. Открой созданного пользователя → **вкладка Raw JSON / App Metadata** →
   добавь в `app_metadata`: `{ "role": "instructor" }` (или `admin`).
   Без этого middleware не пустит в кабинет.
3. Скопируй `UID` пользователя и выполни в **SQL Editor**:

```sql
insert into users (role, name, phone, email, auth_id)
values ('instructor', 'Иван', '84901234567', 'ivan@example.com', '<UID из шага 1>');
```

## Проверка

- `/login` → вход по email или телефону + пароль.
- Инструктор попадает на `/instructor`, админ — на `/admin`.
- Инструктор НЕ должен открывать `/admin` (его средиректит в свой кабинет).

## Примечания

- Телефон храним цифрами (`84901234567`) — вход по телефону сравнивает
  последние 9 цифр, так что формат ввода на логине не важен.
- Смена пароля — пока через Supabase-дашборд (Reset password) или пересоздание.
- Члены клуба и агенты — на этапе 5 (инвайт-ссылки из админки).
