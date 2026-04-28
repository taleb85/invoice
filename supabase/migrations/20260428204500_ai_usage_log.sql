-- Token / cost tracking for Gemini usage (scanner, email sync, admin tools).

CREATE TABLE IF NOT EXISTS public.ai_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id uuid REFERENCES public.sedi(id) ON DELETE CASCADE,
  documento_id uuid REFERENCES public.documenti_da_processare(id) ON DELETE SET NULL,
  model text DEFAULT 'gemini-2.5-flash-lite',
  tokens_input integer NOT NULL DEFAULT 0,
  tokens_output integer NOT NULL DEFAULT 0,
  costo_usd numeric(10, 8) NOT NULL DEFAULT 0,
  tipo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage: admin only" ON public.ai_usage_log;

CREATE POLICY "ai_usage: admin only"
  ON public.ai_usage_log
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_ai_usage_sede_id
  ON public.ai_usage_log (sede_id, created_at DESC);

COMMENT ON TABLE public.ai_usage_log IS 'Gemini token usage per sede/documento — inseriti server-side con service_role.';
