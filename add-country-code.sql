-- ══════════════════════════════════════════════════════════════════
-- MIGRAZIONE: Aggiunge country_code alla tabella sedi
-- Eseguire una sola volta in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════════

-- 1. Aggiungi colonna (se non esiste già)
ALTER TABLE public.sedi
  ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) NOT NULL DEFAULT 'UK';

-- 2. Aggiungi CHECK constraint per i codici paese supportati
ALTER TABLE public.sedi
  DROP CONSTRAINT IF EXISTS sedi_country_code_check;

ALTER TABLE public.sedi
  ADD CONSTRAINT sedi_country_code_check
  CHECK (country_code IN ('UK', 'IT', 'FR', 'DE', 'ES'));

-- 3. Aggiorna tutte le sedi esistenti senza country_code (retrocompatibilità)
UPDATE public.sedi
  SET country_code = 'UK'
  WHERE country_code IS NULL OR country_code = '';

-- 4. (Opzionale) Commento colonna per documentazione
COMMENT ON COLUMN public.sedi.country_code IS
  'Codice paese ISO-2 (UK, IT, FR, DE, ES). Usato per localizzare etichette fiscali (VAT, TVA, IVA) e formattazione valuta.';
