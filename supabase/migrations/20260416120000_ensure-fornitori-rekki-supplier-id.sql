-- Idempotent: mapping Rekki su fornitore (già presente in admin-log-sede-sync-health-rekki-id.sql).
ALTER TABLE public.fornitori
  ADD COLUMN IF NOT EXISTS rekki_supplier_id text;

COMMENT ON COLUMN public.fornitori.rekki_supplier_id IS 'Identificativo fornitore su Rekki per mapping e confronto listini.';
