-- Migration: Create rekki_price_history table for tracking historical prices from emails
CREATE TABLE IF NOT EXISTS public.rekki_price_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fornitore_id uuid NOT NULL REFERENCES public.fornitori(id) ON DELETE CASCADE,
  sede_id uuid REFERENCES public.sedi(id) ON DELETE SET NULL,
  prodotto text NOT NULL,
  prodotto_normalized text NOT NULL, -- lowercase, trimmed for matching
  prezzo_unitario numeric(10,2) NOT NULL,
  quantita numeric(10,2),
  email_message_id text NOT NULL,
  email_subject text,
  email_date timestamptz NOT NULL,
  discovered_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast fornitore + product lookups
CREATE INDEX IF NOT EXISTS idx_rekki_price_history_fornitore_product 
  ON public.rekki_price_history(fornitore_id, prodotto_normalized, email_date DESC);

-- Index for email message ID (prevent duplicates)
CREATE INDEX IF NOT EXISTS idx_rekki_price_history_message_id 
  ON public.rekki_price_history(email_message_id, prodotto_normalized);

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_rekki_price_history_date 
  ON public.rekki_price_history(email_date DESC);

-- Index for full-text search on product names
CREATE INDEX IF NOT EXISTS idx_rekki_price_history_product_text 
  ON public.rekki_price_history USING gin(to_tsvector('english', prodotto));

-- RLS policies
ALTER TABLE public.rekki_price_history ENABLE ROW LEVEL SECURITY;

-- Admin can see all
CREATE POLICY "rekki_price_history_admin_all" ON public.rekki_price_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Users can see history for their sede
CREATE POLICY "rekki_price_history_sede_select" ON public.rekki_price_history
  FOR SELECT
  USING (
    sede_id IN (
      SELECT sede_id FROM public.profiles WHERE profiles.id = auth.uid()
    )
  );

COMMENT ON TABLE public.rekki_price_history IS 'Historical price tracking from Rekki order confirmation emails for refund analysis';
COMMENT ON COLUMN public.rekki_price_history.prodotto_normalized IS 'Lowercase, trimmed version for fuzzy matching';
COMMENT ON COLUMN public.rekki_price_history.email_message_id IS 'Gmail message ID to link back to source email';
COMMENT ON COLUMN public.rekki_price_history.metadata IS 'Additional context: order_id, supplier_name, etc.';

-- Create materialized view for lowest prices per product
CREATE MATERIALIZED VIEW IF NOT EXISTS public.rekki_lowest_prices AS
SELECT 
  fornitore_id,
  prodotto_normalized,
  MIN(prezzo_unitario) as lowest_price,
  MAX(email_date) as last_seen_at,
  COUNT(*) as occurrence_count,
  array_agg(DISTINCT email_message_id) as email_ids
FROM public.rekki_price_history
GROUP BY fornitore_id, prodotto_normalized;

CREATE UNIQUE INDEX ON public.rekki_lowest_prices(fornitore_id, prodotto_normalized);

COMMENT ON MATERIALIZED VIEW public.rekki_lowest_prices IS 'Cached lowest prices per product for fast refund analysis';
