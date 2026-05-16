ALTER TABLE public.documenti_verifica_action_log
  ADD COLUMN IF NOT EXISTS documento_categoria text;

CREATE INDEX IF NOT EXISTS idx_verifica_action_log_documento_categoria ON public.documenti_verifica_action_log (documento_categoria);
