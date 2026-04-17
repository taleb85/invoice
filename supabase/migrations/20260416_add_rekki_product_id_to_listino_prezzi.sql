-- =========================================================
--  Add rekki_product_id to listino_prezzi table
--  Migration for Phase 2: Rekki Product Mapping
-- =========================================================

-- Add the rekki_product_id column (nullable text field)
ALTER TABLE public.listino_prezzi 
  ADD COLUMN IF NOT EXISTS rekki_product_id text;

-- Add an index for faster lookups when searching by rekki_product_id
CREATE INDEX IF NOT EXISTS idx_listino_rekki_product_id 
  ON public.listino_prezzi (rekki_product_id) 
  WHERE rekki_product_id IS NOT NULL;

-- Add a comment to document the column purpose
COMMENT ON COLUMN public.listino_prezzi.rekki_product_id IS 
  'ID univoco del prodotto su Rekki (es. codice della cassa di vino specifica) - utilizzato per confrontare prezzi tra ordini Rekki e listino ufficiale';
