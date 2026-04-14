-- =========================================================
--  Listino Prezzi — tabella storico prezzi per prodotto
--  Esegui questo script nel Supabase Dashboard → SQL Editor
-- =========================================================

CREATE TABLE IF NOT EXISTS public.listino_prezzi (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  fornitore_id uuid        NOT NULL REFERENCES public.fornitori(id)  ON DELETE CASCADE,
  sede_id      uuid                 REFERENCES public.sedi(id)        ON DELETE SET NULL,
  prodotto     text        NOT NULL,
  prezzo       numeric(12,2) NOT NULL,
  data_prezzo  date        NOT NULL,
  note         text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listino_fornitore  ON public.listino_prezzi (fornitore_id);
CREATE INDEX IF NOT EXISTS idx_listino_sede       ON public.listino_prezzi (sede_id);
CREATE INDEX IF NOT EXISTS idx_listino_prodotto   ON public.listino_prezzi (prodotto, data_prezzo);

-- RLS: visibile a tutti gli utenti autenticati
ALTER TABLE public.listino_prezzi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listino_select" ON public.listino_prezzi;
DROP POLICY IF EXISTS "listino_all"    ON public.listino_prezzi;
DROP POLICY IF EXISTS "listino_insert_authenticated" ON public.listino_prezzi;
DROP POLICY IF EXISTS "listino_update_authenticated" ON public.listino_prezzi;
DROP POLICY IF EXISTS "listino_delete_authenticated" ON public.listino_prezzi;

CREATE POLICY "listino_select" ON public.listino_prezzi
  FOR SELECT USING (auth.role() IN ('authenticated','service_role'));

CREATE POLICY "listino_all" ON public.listino_prezzi
  FOR ALL USING (auth.role() = 'service_role');

-- Scritture da client (operatori): stesso criterio sede delle bolle/fatture
CREATE POLICY "listino_insert_authenticated" ON public.listino_prezzi
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.fornitori f
      WHERE f.id = fornitore_id AND f.sede_id IS NOT NULL
        AND f.sede_id = public.get_user_sede()
    )
  );

CREATE POLICY "listino_update_authenticated" ON public.listino_prezzi
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.fornitori f
      WHERE f.id = fornitore_id AND f.sede_id IS NOT NULL
        AND f.sede_id = public.get_user_sede()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.fornitori f
      WHERE f.id = fornitore_id AND f.sede_id IS NOT NULL
        AND f.sede_id = public.get_user_sede()
    )
  );

CREATE POLICY "listino_delete_authenticated" ON public.listino_prezzi
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.fornitori f
      WHERE f.id = fornitore_id AND f.sede_id IS NOT NULL
        AND f.sede_id = public.get_user_sede()
    )
  );
