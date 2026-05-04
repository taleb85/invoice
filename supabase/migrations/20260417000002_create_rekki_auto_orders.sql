-- Migration: Create rekki_auto_orders table for tracking automatically processed Rekki orders
CREATE TABLE IF NOT EXISTS public.rekki_auto_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fornitore_id uuid NOT NULL REFERENCES public.fornitori(id) ON DELETE CASCADE,
  sede_id uuid REFERENCES public.sedi(id) ON DELETE SET NULL,
  email_message_id text NOT NULL,
  email_subject text,
  email_received_at timestamptz,
  processed_at timestamptz DEFAULT now() NOT NULL,
  products_extracted integer DEFAULT 0 NOT NULL,
  products_updated integer DEFAULT 0 NOT NULL,
  products_created integer DEFAULT 0 NOT NULL,
  statement_id uuid REFERENCES public.statements(id) ON DELETE SET NULL,
  status text DEFAULT 'processing' NOT NULL CHECK (status IN ('processing', 'completed', 'error')),
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for fast fornitore lookups
CREATE INDEX IF NOT EXISTS idx_rekki_auto_orders_fornitore 
  ON public.rekki_auto_orders(fornitore_id, processed_at DESC);

-- Index for email message ID (prevent duplicates)
CREATE INDEX IF NOT EXISTS idx_rekki_auto_orders_message_id 
  ON public.rekki_auto_orders(email_message_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_rekki_auto_orders_status 
  ON public.rekki_auto_orders(status, processed_at DESC);

-- RLS policies
ALTER TABLE public.rekki_auto_orders ENABLE ROW LEVEL SECURITY;

-- Admin can see all
CREATE POLICY "rekki_auto_orders_admin_all" ON public.rekki_auto_orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Users can see orders for their sede
CREATE POLICY "rekki_auto_orders_sede_select" ON public.rekki_auto_orders
  FOR SELECT
  USING (
    sede_id IN (
      SELECT sede_id FROM public.profiles WHERE profiles.id = auth.uid()
    )
  );

COMMENT ON TABLE public.rekki_auto_orders IS 'Tracks automatically processed Rekki order confirmation emails';
COMMENT ON COLUMN public.rekki_auto_orders.email_message_id IS 'Gmail message ID to prevent duplicate processing';
COMMENT ON COLUMN public.rekki_auto_orders.status IS 'processing | completed | error';
COMMENT ON COLUMN public.rekki_auto_orders.metadata IS 'Additional data: lines[], price_changes[], anomalies[]';
