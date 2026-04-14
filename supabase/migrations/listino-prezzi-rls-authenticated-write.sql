-- listino_prezzi: consenti INSERT/UPDATE/DELETE agli operatori per righe il cui fornitore
-- appartiene alla loro sede (come bolle/fatture). Prima solo service_role poteva scrivere,
-- quindi l’UI in ListinoTab falliva con "violates row-level security policy".

DROP POLICY IF EXISTS "listino_insert_authenticated" ON public.listino_prezzi;
DROP POLICY IF EXISTS "listino_update_authenticated" ON public.listino_prezzi;
DROP POLICY IF EXISTS "listino_delete_authenticated" ON public.listino_prezzi;

CREATE POLICY "listino_insert_authenticated" ON public.listino_prezzi
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.fornitori f
      WHERE f.id = fornitore_id
        AND f.sede_id IS NOT NULL
        AND f.sede_id = public.get_user_sede()
    )
  );

CREATE POLICY "listino_update_authenticated" ON public.listino_prezzi
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.fornitori f
      WHERE f.id = fornitore_id
        AND f.sede_id IS NOT NULL
        AND f.sede_id = public.get_user_sede()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.fornitori f
      WHERE f.id = fornitore_id
        AND f.sede_id IS NOT NULL
        AND f.sede_id = public.get_user_sede()
    )
  );

CREATE POLICY "listino_delete_authenticated" ON public.listino_prezzi
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.fornitori f
      WHERE f.id = fornitore_id
        AND f.sede_id IS NOT NULL
        AND f.sede_id = public.get_user_sede()
    )
  );
