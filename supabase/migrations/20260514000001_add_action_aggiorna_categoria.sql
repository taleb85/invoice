ALTER TABLE public.documenti_verifica_action_log
  DROP CONSTRAINT IF EXISTS documenti_verifica_action_log_action_check;

ALTER TABLE public.documenti_verifica_action_log
  ADD CONSTRAINT documenti_verifica_action_log_action_check
  CHECK (action IN ('scarta', 'resetta', 'elimina_duplicato', 'aggiorna_categoria'));
