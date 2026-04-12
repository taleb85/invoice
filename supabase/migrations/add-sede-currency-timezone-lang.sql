-- ============================================================
-- Migration: Add currency + timezone to sedi, language to fornitori
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. sede currency (ISO 4217 code, e.g. GBP, EUR, USD, CHF)
ALTER TABLE public.sedi
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'GBP';

-- 2. sede timezone (IANA tz name, e.g. Europe/London, Europe/Rome)
ALTER TABLE public.sedi
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/London';

-- 3. supplier preferred language (ISO 639-1: it, en, fr, de, es)
--    NULL means "inherit from sede"
ALTER TABLE public.fornitori
  ADD COLUMN IF NOT EXISTS language CHAR(2) DEFAULT NULL;

-- Back-fill existing sedi based on country_code
UPDATE public.sedi SET
  currency = CASE country_code
    WHEN 'UK' THEN 'GBP'
    WHEN 'IT' THEN 'EUR'
    WHEN 'FR' THEN 'EUR'
    WHEN 'DE' THEN 'EUR'
    WHEN 'ES' THEN 'EUR'
    ELSE 'EUR'
  END,
  timezone = CASE country_code
    WHEN 'UK' THEN 'Europe/London'
    WHEN 'IT' THEN 'Europe/Rome'
    WHEN 'FR' THEN 'Europe/Paris'
    WHEN 'DE' THEN 'Europe/Berlin'
    WHEN 'ES' THEN 'Europe/Madrid'
    ELSE 'Europe/London'
  END
WHERE currency IS NULL OR currency = 'GBP';

-- Force PostgREST to reload schema
SELECT pg_notify('pgrst', 'reload schema');
