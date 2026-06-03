-- Traccia estrazione listino da bolla (come fatture.analizzata)
ALTER TABLE public.bolle
  ADD COLUMN IF NOT EXISTS analizzata boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bolle.analizzata IS 'True dopo estrazione listino (Analizza / Auto) completata.';
