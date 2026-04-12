-- Esegui nell'SQL Editor di Supabase (Dashboard → SQL → New query) se vedi:
-- "Could not find the 'display_name' column of 'fornitori' in the schema cache"

ALTER TABLE public.fornitori
  ADD COLUMN IF NOT EXISTS display_name text;

COMMENT ON COLUMN public.fornitori.display_name IS 'Optional short label for compact UI; falls back to nome when empty.';

-- PostgREST aggiorna di solito la cache da solo; se l’errore persiste per qualche minuto, da Dashboard:
-- Settings → API → Restart project (opzione estrema) oppure attendi il refresh automatico.
