-- Allinea DB senza migration 20260416: colonna usata da listino / fornitori.
-- Idempotente.
ALTER TABLE public.fatture
  ADD COLUMN IF NOT EXISTS analizzata boolean NOT NULL DEFAULT false;
