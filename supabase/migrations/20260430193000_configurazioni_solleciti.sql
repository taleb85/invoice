-- Tolleranze giorni per solleciti automatici / aging (lettura da app; override possibile senza redeploy).

CREATE TABLE IF NOT EXISTS public.configurazioni_solleciti (
  chiave text PRIMARY KEY CHECK (char_length(trim(chiave)) > 0),
  valore text NOT NULL,
  aggiornato_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.configurazioni_solleciti IS
  'Chiave/valore: giorni di tolleranza per solleciti (interi come stringa). Chiavi attese vedi src/lib/sollecito-aging.ts.';

INSERT INTO public.configurazioni_solleciti (chiave, valore) VALUES
  ('giorni_tolleranza_bolla', '5'),
  ('giorni_tolleranza_promessa_documento', '2'),
  ('giorni_tolleranza_estratto_mismatch', '3')
ON CONFLICT (chiave) DO NOTHING;

ALTER TABLE public.configurazioni_solleciti ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configurazioni_solleciti_select_authenticated ON public.configurazioni_solleciti;
DROP POLICY IF EXISTS configurazioni_solleciti_all_service_role ON public.configurazioni_solleciti;

CREATE POLICY configurazioni_solleciti_select_authenticated
  ON public.configurazioni_solleciti
  FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY configurazioni_solleciti_all_service_role
  ON public.configurazioni_solleciti
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

SELECT pg_notify('pgrst', 'reload schema');
