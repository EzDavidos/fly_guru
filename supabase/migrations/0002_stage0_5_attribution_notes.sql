-- ============================================================================
-- FlyGuru — Этап 0.5: атрибуция заявок, внутренние заметки, факт оплаты
-- Источник правды: docs/flyguru_architecture.md.
-- Только additive-изменения (ADD COLUMN / ADD VALUE), с IF NOT EXISTS —
-- миграция безопасна на чистой базе и идемпотентна при повторном прогоне.
-- Ничего не удаляется и не переименовывается. RLS не трогаем (роли — Этап 3).
--
-- Финансовая логика (закрепляется здесь, реализуется на Этапе 4):
--   subscriptions.paid_at — момент фактической оплаты абонемента. Оплата офлайн
--   (QR / крипта / наличные), поэтому факт оплаты фиксируется вручную и не
--   совпадает с sold_at (моментом создания записи).
--   Комиссия инструктора 10% с продажи абонемента начисляется ПО ФАКТУ ОПЛАТЫ
--   (paid_at IS NOT NULL), а не по факту создания записи. В месячные финансовые
--   расчёты Этапа 4 попадают ТОЛЬКО оплаченные абонементы (paid_at IS NOT NULL).
-- ============================================================================

-- ── ENUM booking_status ──────────────────────────────────────────────────────
-- Было (0001): new, confirmed, done, cancelled.
-- Цель: new, contacted, confirmed, done, cancelled, archived.
-- Добавляем недостающие значения; существующие не переименовываем.
-- ADD VALUE вынесен вперёд и новые значения в этой же миграции НЕ используются —
-- ограничение Postgres на использование свежего enum-значения в той же
-- транзакции нас не затрагивает.
alter type booking_status add value if not exists 'contacted' before 'confirmed';
alter type booking_status add value if not exists 'archived';

-- ── bookings: атрибуция + внутренняя заметка ─────────────────────────────────
-- src  — источник перехода (instagram, qr, flyer, partner …).
-- utm  — utm_source/medium/campaign/term/content + click id (gclid, fbclid).
-- internal_note — заметка менеджера, клиенту не видна.
-- (ref_code на bookings уже есть из 0001 — не дублируем.)
alter table bookings add column if not exists src           text;
alter table bookings add column if not exists utm           jsonb not null default '{}'::jsonb;
alter table bookings add column if not exists internal_note text;

-- ── product_requests: атрибуция ──────────────────────────────────────────────
alter table product_requests add column if not exists ref_code text;
alter table product_requests add column if not exists src      text;
alter table product_requests add column if not exists utm      jsonb not null default '{}'::jsonb;

-- ── clients: внутренняя заметка ──────────────────────────────────────────────
alter table clients add column if not exists internal_note text;

-- ── subscriptions: факт оплаты ───────────────────────────────────────────────
-- NULL = ещё не оплачено (комиссия не начисляется, в финрасчёты не попадает).
alter table subscriptions add column if not exists paid_at timestamptz;
