-- Aggiunge colonna is_credit_note alla tabella fatture
ALTER TABLE public.fatture ADD COLUMN IF NOT EXISTS is_credit_note boolean NOT NULL DEFAULT false;

-- Indice per filtrare velocemente le note di credito
CREATE INDEX IF NOT EXISTS idx_fatture_is_credit_note ON public.fatture (is_credit_note) WHERE is_credit_note = true;
