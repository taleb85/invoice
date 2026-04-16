-- Riferimento ordine esplicito per deduplicazione (criterio: numero_ordine + fornitore_id + data_ordine).
ALTER TABLE public.conferme_ordine
  ADD COLUMN IF NOT EXISTS numero_ordine text;

COMMENT ON COLUMN public.conferme_ordine.numero_ordine IS
  'Numero ordine commerciale; se NULL in UI si usa il titolo come fallback per il raggruppamento duplicati.';
