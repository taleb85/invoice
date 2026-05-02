-- Consente a operatore / admin_tecnico di leggere le righe profilo dei colleghi nella stessa sede
-- (nome + ruolo in elenco «Chi è di turno»). admin_sede è già coperto da profiles_select_admin_sede.
-- Serve perché GET /api/sede-operators?sedeScope=session usa il client di sessione (senza service role).

CREATE POLICY "profiles_select_colleagues_branch_desk"
ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles AS caller
    WHERE caller.id = auth.uid()
      AND caller.role IN ('operatore', 'admin_tecnico')
      AND caller.sede_id IS NOT NULL
      AND caller.sede_id = profiles.sede_id
  )
);
