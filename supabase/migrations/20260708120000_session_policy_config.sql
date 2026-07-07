-- Configurazioni chiave/valore generiche per l'app (solleciti e altro) + session policy.

CREATE TABLE IF NOT EXISTS public.configurazioni_app (
  chiave text PRIMARY KEY CHECK (char_length(trim(chiave)) > 0),
  valore text NOT NULL,
  descrizione text
);

COMMENT ON TABLE public.configurazioni_app IS
  'Parametri applicativi (chiave univoca). Solleciti: chiavi italiane vedi src/lib/sollecito-aging.ts.';

INSERT INTO public.configurazioni_app (chiave, valore, descrizione) VALUES
  -- Valori default solleciti
  ('solleciti_automatici_attivi', 'true', 'Abilita o disabilita l''invio automatico dei solleciti.'),
  ('giorni_attesa_bolla', '5', 'Giorni dalla data documento (bolla in attesa) prima di considerare il caso per i solleciti.'),
  ('giorni_attesa_promessa', '2', 'Giorni dalla creazione del record quando metadata.promessa_invio_documento è true, prima del sollecito documento promesso.'),
  ('giorni_attesa_mismatch_estratto', '3', 'Giorni di attesa per righe estratto con stato mismatch / errore sul triple-check.'),
  -- Valori default session policy (auto-logout)
  ('sessione_operatore_max_age_seconds',       '28800', 'Operatore — durata massima sessione in secondi (default: 8 ore)'),
  ('sessione_operatore_inactivity_seconds',     '1800',  'Operatore — timeout inattività in secondi (default: 30 min)'),
  ('sessione_admin_max_age_seconds',            '86400', 'Admin — durata massima sessione in secondi (default: 24 ore)'),
  ('sessione_admin_inactivity_seconds',         '7200',  'Admin — timeout inattività in secondi (default: 2 ore)'),
  ('sessione_admin_sede_max_age_seconds',       '86400', 'Admin sede — durata massima sessione in secondi (default: 24 ore)'),
  ('sessione_admin_sede_inactivity_seconds',    '7200',  'Admin sede — timeout inattività in secondi (default: 2 ore)')
ON CONFLICT (chiave) DO NOTHING;

-- RLS policies
ALTER TABLE public.configurazioni_app ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS configurazioni_app_select_authenticated ON public.configurazioni_app;
DROP POLICY IF EXISTS configurazioni_app_all_service_role ON public.configurazioni_app;
DROP POLICY IF EXISTS configurazioni_app_staff_write ON public.configurazioni_app;

CREATE POLICY configurazioni_app_select_authenticated
  ON public.configurazioni_app
  FOR SELECT
  USING (auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY configurazioni_app_all_service_role
  ON public.configurazioni_app
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY configurazioni_app_staff_write
  ON public.configurazioni_app
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'admin_sede')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'admin_sede')
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
