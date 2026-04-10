-- ============================================================
-- MIGRATION: Aggiungi 'da_associare' al CHECK constraint dello
-- stato su documenti_da_processare.
--
-- Problema: la constraint originale ammetteva solo
--   ('in_attesa', 'associato', 'scartato')
-- ma la nuova logica di scan-emails e retry-log salva i documenti
-- con stato 'da_associare', causando il rifiuto silenzioso di ogni
-- insert e il conseguente errore "Bolla mancante" nel log.
--
-- Eseguire una sola volta su Supabase SQL Editor.
-- ============================================================

-- 1. Rimuovi il vecchio constraint (nome generato automaticamente da PostgreSQL)
ALTER TABLE public.documenti_da_processare
  DROP CONSTRAINT IF EXISTS documenti_da_processare_stato_check;

-- 2. Aggiungi il nuovo constraint che include 'da_associare'
ALTER TABLE public.documenti_da_processare
  ADD CONSTRAINT documenti_da_processare_stato_check
  CHECK (stato IN ('in_attesa', 'da_associare', 'associato', 'scartato'));

-- 3. Converti i record esistenti con stato 'in_attesa' che hanno già un file
--    ma non sono stati associati (opzionale — lascia 'in_attesa' invariato se
--    non vuoi migrare i vecchi dati)
-- UPDATE public.documenti_da_processare
--   SET stato = 'da_associare'
--   WHERE stato = 'in_attesa';
