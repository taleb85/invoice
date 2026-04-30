-- Configurazioni chiave/valore generiche per l'app (solleciti e altro).

CREATE TABLE IF NOT EXISTS public.configurazioni_app (
  chiave text PRIMARY KEY CHECK (char_length(trim(chiave)) > 0),
  valore text NOT NULL,
  descrizione text
);

COMMENT ON TABLE public.configurazioni_app IS
  'Parametri applicativi (chiave univoca). Solleciti: chiavi italiane vedi src/lib/sollecito-aging.ts.';

INSERT INTO public.configurazioni_app (chiave, valore, descrizione) VALUES
  (
    'solleciti_automatici_attivi',
    'true',
    'Abilita o disabilita l''invio automatico dei solleciti.'
  ),
  (
    'giorni_attesa_bolla',
    '5',
    'Giorni dalla data documento (bolla in attesa) prima di considerare il caso per i solleciti.'
  ),
  (
    'giorni_attesa_promessa',
    '2',
    'Giorni dalla creazione del record quando metadata.promessa_invio_documento è true, prima del sollecito documento promesso.'
  ),
  (
    'giorni_attesa_mismatch_estratto',
    '3',
    'Giorni di attesa per righe estratto con stato mismatch / errore sul triple-check.'
  )
ON CONFLICT (chiave) DO NOTHING;

-- Copia valori già tunati da configurazioni_solleciti (chiavi legacy → italiane).
INSERT INTO public.configurazioni_app (chiave, valore, descrizione)
SELECT m.nuova_chiave, cs.valore, m.descrizione
FROM public.configurazioni_solleciti cs
INNER JOIN (
  VALUES
    ('auto_solleciti_enabled'::text, 'solleciti_automatici_attivi'::text, 'Abilita o disabilita l''invio automatico dei solleciti.'::text),
    ('giorni_tolleranza_bolla', 'giorni_attesa_bolla', 'Giorni dalla data documento (bolla in attesa) prima di considerare il caso per i solleciti.'),
    ('giorni_tolleranza_promessa_documento', 'giorni_attesa_promessa', 'Giorni dalla creazione del record quando metadata.promessa_invio_documento è true, prima del sollecito documento promesso.'),
    ('giorni_tolleranza_estratto_mismatch', 'giorni_attesa_mismatch_estratto', 'Giorni di attesa per righe estratto con stato mismatch / errore sul triple-check.')
) AS m(vecchia_chiave, nuova_chiave, descrizione)
  ON cs.chiave = m.vecchia_chiave
ON CONFLICT (chiave) DO UPDATE SET
  valore = EXCLUDED.valore;

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
