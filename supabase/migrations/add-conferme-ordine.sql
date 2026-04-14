-- Conferme d'ordine archiviate per fornitore (PDF in Storage + metadati in tabella).

CREATE TABLE IF NOT EXISTS public.conferme_ordine (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornitore_id  uuid NOT NULL REFERENCES public.fornitori(id) ON DELETE CASCADE,
  sede_id       uuid REFERENCES public.sedi(id) ON DELETE SET NULL,
  file_url      text NOT NULL,
  file_name     text,
  titolo        text,
  data_ordine   date,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conferme_ordine_fornitore_created_idx
  ON public.conferme_ordine (fornitore_id, created_at DESC);

COMMENT ON TABLE public.conferme_ordine IS
  'Order confirmations and similar commercial PDFs linked to a supplier; not part of bolla/fattura workflow.';

ALTER TABLE public.conferme_ordine ENABLE ROW LEVEL SECURITY;

-- SELECT: stesso perimetro sede degli altri strumenti fornitore (listino / bolle via fornitore).
CREATE POLICY "conferme_ordine_select" ON public.conferme_ordine
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.fornitori f
      WHERE f.id = conferme_ordine.fornitore_id
        AND f.sede_id IS NOT NULL
        AND f.sede_id = public.get_user_sede()
    )
  );

CREATE POLICY "conferme_ordine_insert" ON public.conferme_ordine
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

CREATE POLICY "conferme_ordine_delete" ON public.conferme_ordine
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.fornitori f
      WHERE f.id = conferme_ordine.fornitore_id
        AND f.sede_id IS NOT NULL
        AND f.sede_id = public.get_user_sede()
    )
  );
