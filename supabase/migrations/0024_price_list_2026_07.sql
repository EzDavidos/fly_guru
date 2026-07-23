-- ============================================================================
-- 0024: обновление прайс-листа по актуальным макетам
-- (photo_video/price_page_1.png, price_page_2.png), пачка правок №5, п.10.
--
-- Правило: услуги ПЕРЕИМЕНОВЫВАЮТСЯ НА МЕСТЕ (id и code сохраняются), чтобы не
-- рвать историю — sessions/bookings ссылаются на services.id. Новых строк
-- всего две. Цены не меняются нигде: только названия, длительность тандема
-- (5 → 10 мин) и две новые услуги.
--
-- Накатывается вручную через Supabase SQL Editor (как 0001–0023).
-- Идемпотентно: повторный прогон ничего не ломает.
-- ============================================================================

-- ── 1. Переименования на месте ──────────────────────────────────────────────
-- Ищем по code (0010), а не по названию: после первого прогона старого имени
-- в базе уже нет, а code вечен.

update services set name = 'Парное базовое обучение'            where code = 'basic-duo';
update services set name = 'Полёт в тандеме (взрослый)'          where code = 'tandem-adult';
update services set name = 'Полёт в тандеме (до 14 лет)'         where code = 'tandem-kid';
update services set name = 'Экскурсия с инструктором'            where code = 'excursion';
update services set name = 'E-Foil Safari'                       where code = 'safari';
update services set name = 'Самостоятельное катание'             where code = 'rental';
update services set name = 'Абонемент 300 минут'                 where code = 'subscription';
update services set name = 'Фото/видео с монтажом'               where code = 'video';

-- ── 2. Длительность тандема: в макете 10 минут вместо 5 ─────────────────────
update services set duration_min = 10 where code in ('tandem-adult', 'tandem-kid');

-- ── 3. Новые услуги ─────────────────────────────────────────────────────────
-- on conflict по code: повторный прогон не создаст дубль.

insert into services (name, duration_min, price, category, code)
values ('Индивидуальное обучающее занятие', 60, 3000000, 'training', 'individual-training')
on conflict (code) do nothing;

insert into services (name, duration_min, price, category, code)
values ('Фото/видео без монтажа', null, 600000, 'extra', 'video-raw')
on conflict (code) do nothing;
