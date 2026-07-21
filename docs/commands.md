# Команды FlyGuru — шпаргалка

Всё запускается из корня проекта. Ключи скрипты берут из `.env.local`
(`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) — вручную их
подставлять не надо.

Подробнее про заведение аккаунтов — в [creating-users.md](./creating-users.md).

---

## Пользователи

Онлайн-регистрации нет — все аккаунты заводит админ/разработчик скриптом.
Роли: `admin`, `instructor`, `member`, `agent`.

```bash
# Админ — вход по email
node scripts/create-user.mjs --role admin --name "Денис" \
  --email denis@example.com --password "придумай-пароль"

# Инструктор — вход по телефону (технический email сгенерится сам)
node scripts/create-user.mjs --role instructor --name "Иван" \
  --phone "+84 90 123 4567" --password "придумай-пароль"

# Инструктор с настоящим email — вход и по email, и по телефону
node scripts/create-user.mjs --role instructor --name "Пётр" \
  --email petr@example.com --phone "+84 91 234 5678" --password "пароль"

# Член клуба / агент — так же, меняется только --role
node scripts/create-user.mjs --role member --name "Гость" \
  --phone "+84 90 000 0000" --password "пароль"
node scripts/create-user.mjs --role agent --name "Отель Sunrise" \
  --email sunrise@example.com --password "пароль"
```

Скрипт делает два шага сразу: аккаунт в Supabase Auth (роль в JWT) и строку
в таблице `users`. После этого человек заходит на `/login`.

## Смена роли существующего пользователя

Роль лежит в ДВУХ местах — в JWT и в `users.role`. Меняй только этим скриптом,
чтобы они не разъехались (иначе, например, повышенного до admin инструктора
middleware выкинет обратно в `/instructor`).

```bash
node scripts/set-role.mjs --role admin --email boss@example.com
node scripts/set-role.mjs --role instructor --phone "+84 90 123 4567"
```

**Важно:** после смены роли пользователь должен ВЫЙТИ и ЗАЙТИ заново — свежий
JWT выдаётся только при новом входе.

## Пароль

Пока меняется через Supabase-дашборд (Authentication → Users → Reset password)
либо пересозданием пользователя. Отдельного скрипта нет.

---

## Разработка

```bash
npm run dev     # локальный сервер (обычно http://localhost:3000)
npm run build   # production-сборка (проверить, что всё компилится)
npm run start   # запустить собранное
npm run lint    # ESLint
```

**Грабли:** если dev-сервер начал сыпать странными ошибками на ровном месте —
это чаще всего повреждённый кэш Turbopack. Лечится так:

```bash
rm -rf .next
npm run dev
```

---

## Миграции базы

Файлы `supabase/migrations/*.sql` накатываются **вручную** через
Supabase → **SQL Editor** (копируешь содержимое файла, выполняешь). Номер файла =
порядок. Автонаката нет намеренно — база продовая, катим осознанно по одной.
