-- ============================================================
-- add-importo-multibolla.sql
-- Eseguire nel SQL Editor di Supabase
-- ============================================================
-- Aggiunge:
--   • numero_bolla + importo alle bolle (DDT)
--   • numero_fattura + importo + verificata_estratto_conto alle fatture
--   • tabella junction fattura_bolle per N bolle → 1 fattura
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. Aggiunte alla tabella bolle
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.bolle
  ADD COLUMN IF NOT EXISTS numero_bolla text,
  ADD COLUMN IF NOT EXISTS importo      numeric(12,2);

COMMENT ON COLUMN public.bolle.numero_bolla IS 'Numero DDT (documento di trasporto)';
COMMENT ON COLUMN public.bolle.importo      IS 'Importo totale della bolla (IVA inclusa)';


-- ──────────────────────────────────────────────────────────────
-- 2. Aggiunte alla tabella fatture
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.fatture
  ADD COLUMN IF NOT EXISTS numero_fattura             text,
  ADD COLUMN IF NOT EXISTS importo                    numeric(12,2),
  ADD COLUMN IF NOT EXISTS verificata_estratto_conto  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.fatture.numero_fattura            IS 'Numero fattura del fornitore';
COMMENT ON COLUMN public.fatture.importo                   IS 'Importo totale fattura (IVA inclusa) — auto-sommato dalle bolle collegate';
COMMENT ON COLUMN public.fatture.verificata_estratto_conto IS 'true = importo verificato rispetto all''estratto conto mensile';


-- ──────────────────────────────────────────────────────────────
-- 3. Tabella junction: N bolle → 1 fattura
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fattura_bolle (
  fattura_id uuid NOT NULL REFERENCES public.fatture(id) ON DELETE CASCADE,
  bolla_id   uuid NOT NULL REFERENCES public.bolle(id)   ON DELETE CASCADE,
  PRIMARY KEY (fattura_id, bolla_id)
);

CREATE INDEX IF NOT EXISTS idx_fattura_bolle_fattura ON public.fattura_bolle(fattura_id);
CREATE INDEX IF NOT EXISTS idx_fattura_bolle_bolla   ON public.fattura_bolle(bolla_id);

ALTER TABLE public.fattura_bolle ENABLE ROW LEVEL SECURITY;

-- Accesso tramite sede_id della fattura
CREATE POLICY "fattura_bolle: select" ON public.fattura_bolle
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fatture f
      WHERE f.id = fattura_id
        AND (public.is_admin() OR f.sede_id = public.get_user_sede())
    )
  );

CREATE POLICY "fattura_bolle: insert" ON public.fattura_bolle
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.fatture f
      WHERE f.id = fattura_id
        AND (public.is_admin() OR f.sede_id = public.get_user_sede())
    )
  );

CREATE POLICY "fattura_bolle: delete" ON public.fattura_bolle
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.fatture f
      WHERE f.id = fattura_id
        AND (public.is_admin() OR f.sede_id = public.get_user_sede())
    )
  );
