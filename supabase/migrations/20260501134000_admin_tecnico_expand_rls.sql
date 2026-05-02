-- Allinea permessi RLS per `profiles.role = 'admin_tecnico'` allo stesso perimetro sede di `admin_sede`
-- (`is_admin_of_sede`, lettura/modifica sede, approval_settings, activity_log, ecc.).

-- § is_admin_of_sede (usa gran parte delle policy INSERT/UPDATE/DELETE su sede/fornitori/bolle/fatture)
CREATE OR REPLACE FUNCTION public.is_admin_of_sede(target_sede_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'admin_sede', 'admin_tecnico')
      AND (role = 'admin' OR sede_id IS NOT DISTINCT FROM target_sede_id)
  )
$$;

-- § profiles SELECT per operatori nella stessa sede
DROP POLICY IF EXISTS "profiles_select_admin_sede" ON public.profiles;

CREATE POLICY "profiles_select_admin_sede"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles AS caller
    WHERE caller.id = auth.uid()
      AND caller.role IN ('admin_sede', 'admin_tecnico')
      AND caller.sede_id IS NOT DISTINCT FROM profiles.sede_id
  )
);

-- § sedi UPDATE solo propria sede
DROP POLICY IF EXISTS "sedi_update_admin_sede" ON public.sedi;

CREATE POLICY "sedi_update_admin_sede"
ON public.sedi FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles AS caller
    WHERE caller.id = auth.uid()
      AND caller.role IN ('admin_sede', 'admin_tecnico')
      AND caller.sede_id IS NOT DISTINCT FROM sedi.id
  )
);

-- § documenti_da_processare: righe inbox globale associate da staff sede
DROP POLICY IF EXISTS "documenti_select_no_sede" ON public.documenti_da_processare;

CREATE POLICY "documenti_select_no_sede"
ON public.documenti_da_processare FOR SELECT
USING (
  sede_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles AS caller
    WHERE caller.id = auth.uid()
      AND caller.role IN ('admin', 'admin_sede', 'admin_tecnico')
  )
);

-- § approval_settings lettura/update per propria sede
DROP POLICY IF EXISTS "admin_sede can read own approval_settings" ON public.approval_settings;

CREATE POLICY "admin_sede can read own approval_settings"
ON public.approval_settings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin_sede', 'admin_tecnico')
      AND sede_id IS NOT DISTINCT FROM approval_settings.sede_id
  )
);

DROP POLICY IF EXISTS "admin_sede can update own approval_settings" ON public.approval_settings;

CREATE POLICY "admin_sede can update own approval_settings"
ON public.approval_settings FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin_sede', 'admin_tecnico')
      AND sede_id IS NOT DISTINCT FROM approval_settings.sede_id
  )
);

-- § activity_log: lettura propria sede
DROP POLICY IF EXISTS "admin_sede can read own sede activity_log" ON public.activity_log;

CREATE POLICY "admin_sede can read own sede activity_log"
ON public.activity_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin_sede', 'admin_tecnico')
      AND sede_id IS NOT DISTINCT FROM activity_log.sede_id
  )
);

-- § configurazioni solleciti / app (staff sede anche tecnico)
DROP POLICY IF EXISTS configurazioni_solleciti_staff_write ON public.configurazioni_solleciti;

CREATE POLICY configurazioni_solleciti_staff_write
  ON public.configurazioni_solleciti
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'admin_sede', 'admin_tecnico')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'admin_sede', 'admin_tecnico')
    )
  );

DROP POLICY IF EXISTS configurazioni_app_staff_write ON public.configurazioni_app;

CREATE POLICY configurazioni_app_staff_write
  ON public.configurazioni_app
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'admin_sede', 'admin_tecnico')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'admin_sede', 'admin_tecnico')
    )
  );

SELECT pg_notify('pgrst', 'reload schema');
