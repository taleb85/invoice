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

CREATE POLICY "listino_select" ON public.listino_prezzi
  FOR SELECT USING (auth.role() IN ('authenticated','service_role'));

CREATE POLICY "listino_all" ON public.listino_prezzi
  FOR ALL USING (auth.role() = 'service_role');
