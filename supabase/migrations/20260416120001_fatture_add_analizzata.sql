-- Flag listino: fattura sottoposta ad analisi AI estrazione righe (tab Listino → Analizza).
-- Esegui su Supabase (migrations o SQL Editor) prima di usare la colonna dal client.

ALTER TABLE public.fatture
  ADD COLUMN IF NOT EXISTS analizzata boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.fatture.analizzata IS 'True dopo estrazione listino (Analizza) completata con successo.';
