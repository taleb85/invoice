ALTER TABLE public.conferme_ordine
  ADD COLUMN IF NOT EXISTS analizzata boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.conferme_ordine.analizzata IS 'True dopo estrazione listino (Analizza / Auto) completata.';
