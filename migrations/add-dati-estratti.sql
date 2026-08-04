-- Aggiunge colonna dati_estratti per salvare i dati estratti da OCR/text-parsing in modo permanente.
-- Così i PDF possono essere cancellati dalla retention senza perdere i prezzi.
ALTER TABLE public.fatture ADD COLUMN IF NOT EXISTS dati_estratti jsonb;
ALTER TABLE public.bolle ADD COLUMN IF NOT EXISTS dati_estratti jsonb;
ALTER TABLE public.conferme_ordine ADD COLUMN IF NOT EXISTS dati_estratti jsonb;
