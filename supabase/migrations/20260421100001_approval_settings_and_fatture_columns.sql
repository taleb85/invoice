-- Create approval_settings table
CREATE TABLE IF NOT EXISTS public.approval_settings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id          uuid NOT NULL UNIQUE REFERENCES public.sedi(id) ON DELETE CASCADE,
  threshold        numeric(12,2) NOT NULL DEFAULT 500,
  require_approval boolean NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin can manage approval_settings"
  ON public.approval_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "admin_sede can read own approval_settings"
  ON public.approval_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin_sede'
        AND sede_id = approval_settings.sede_id
    )
  );

CREATE POLICY "admin_sede can update own approval_settings"
  ON public.approval_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role = 'admin_sede'
        AND sede_id = approval_settings.sede_id
    )
  );

CREATE POLICY "service role can manage approval_settings"
  ON public.approval_settings FOR ALL
  USING (auth.role() = 'service_role');

-- Add approval columns to fatture
ALTER TABLE public.fatture
  ADD COLUMN IF NOT EXISTS approval_status    text CHECK (approval_status IN ('pending','approved','rejected','not_required')),
  ADD COLUMN IF NOT EXISTS approval_threshold numeric(12,2),
  ADD COLUMN IF NOT EXISTS approved_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at        timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason   text;

CREATE INDEX IF NOT EXISTS fatture_approval_status_idx ON public.fatture(approval_status)
  WHERE approval_status IS NOT NULL;
