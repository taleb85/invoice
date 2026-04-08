-- ============================================================
-- sedi-imap.sql — Eseguire nel SQL Editor di Supabase
-- Aggiunge configurazione IMAP per-sede alla tabella sedi
-- ============================================================

alter table public.sedi add column if not exists imap_host     text;
alter table public.sedi add column if not exists imap_port     integer default 993;
alter table public.sedi add column if not exists imap_user     text;
alter table public.sedi add column if not exists imap_password text;
