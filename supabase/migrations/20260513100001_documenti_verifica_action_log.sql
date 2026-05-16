CREATE TABLE IF NOT EXISTS public.documenti_verifica_action_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  documento_id uuid NOT NULL,
  action      text NOT NULL CHECK (action IN ('scarta', 'resetta', 'elimina_duplicato')),
  anomalie_tipi text[] NOT NULL DEFAULT '{}',
  anomalie_gravita text NOT NULL DEFAULT 'nessuna',
  anomalie_count integer NOT NULL DEFAULT 0,
  consigliato text,
  seguito_consiglio boolean NOT NULL DEFAULT false,
  batch_id    text,
  fornitore_id uuid,
  fornitore_nome text,
  file_name   text,
  sede_id     uuid,
  user_id     uuid
);

CREATE INDEX IF NOT EXISTS idx_verifica_action_log_created_at ON public.documenti_verifica_action_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verifica_action_log_action ON public.documenti_verifica_action_log (action);
CREATE INDEX IF NOT EXISTS idx_verifica_action_log_anomalie_tipi ON public.documenti_verifica_action_log USING GIN (anomalie_tipi);
CREATE INDEX IF NOT EXISTS idx_verifica_action_log_consigliato ON public.documenti_verifica_action_log (consigliato);

ALTER TABLE public.documenti_verifica_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documenti_verifica_action_log_service_role"
  ON public.documenti_verifica_action_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
