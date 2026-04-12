-- Migration: add imap_lookback_days to sedi
-- Run in Supabase Dashboard → SQL Editor

ALTER TABLE public.sedi
  ADD COLUMN IF NOT EXISTS imap_lookback_days integer DEFAULT 30;

COMMENT ON COLUMN public.sedi.imap_lookback_days IS
  'Quanti giorni indietro leggere le email non lette (default 30). NULL = nessun limite.';
