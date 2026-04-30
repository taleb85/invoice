-- Consenti ad admin/admin_sede di aggiornare le soglie solleciti (UI impostazioni).
-- + seed flag automazione globale.

INSERT INTO public.configurazioni_solleciti (chiave, valore)
VALUES ('auto_solleciti_enabled', 'true')
ON CONFLICT (chiave) DO NOTHING;

DROP POLICY IF EXISTS configurazioni_solleciti_staff_write ON public.configurazioni_solleciti;

CREATE POLICY configurazioni_solleciti_staff_write
  ON public.configurazioni_solleciti
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
