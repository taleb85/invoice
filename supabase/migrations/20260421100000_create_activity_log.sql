-- Create activity_log table for operator activity tracking
CREATE TABLE IF NOT EXISTS public.activity_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sede_id     uuid REFERENCES public.sedi(id) ON DELETE CASCADE,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text,
  entity_label text,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS activity_log_sede_id_idx    ON public.activity_log(sede_id);
CREATE INDEX IF NOT EXISTS activity_log_user_id_idx    ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS activity_log_created_at_idx ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS activity_log_action_idx     ON public.activity_log(action);

-- RLS: only admins can read; service role can insert via logActivity()
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Master admins see all rows
CREATE POLICY "admin can read activity_log"
  ON public.activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- admin_sede can only see their own sede
CREATE POLICY "admin_sede can read own sede activity_log"
  ON public.activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin_sede'
        AND sede_id = activity_log.sede_id
    )
  );

-- Only service role can insert (logActivity uses createServiceClient)
CREATE POLICY "service role can insert activity_log"
  ON public.activity_log FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
