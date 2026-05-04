-- Migration: Create user_settings table for storing Gmail OAuth tokens securely
CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  sede_id uuid REFERENCES public.sedi(id) ON DELETE SET NULL,
  setting_key text NOT NULL,
  setting_value text, -- Encrypted value
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, sede_id, setting_key)
);

-- Index for fast user + key lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_key 
  ON public.user_settings(user_id, setting_key);

-- Index for sede-based settings
CREATE INDEX IF NOT EXISTS idx_user_settings_sede 
  ON public.user_settings(sede_id) WHERE sede_id IS NOT NULL;

-- RLS policies
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own settings
CREATE POLICY "user_settings_own_select" ON public.user_settings
  FOR SELECT
  USING (user_id = auth.uid());

-- Users can only update their own settings
CREATE POLICY "user_settings_own_update" ON public.user_settings
  FOR UPDATE
  USING (user_id = auth.uid());

-- Users can insert their own settings
CREATE POLICY "user_settings_own_insert" ON public.user_settings
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own settings
CREATE POLICY "user_settings_own_delete" ON public.user_settings
  FOR DELETE
  USING (user_id = auth.uid());

-- Admin can see all settings
CREATE POLICY "user_settings_admin_all" ON public.user_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_user_settings_updated_at();

COMMENT ON TABLE public.user_settings IS 'Stores user-specific settings including encrypted OAuth tokens';
COMMENT ON COLUMN public.user_settings.setting_key IS 'Setting identifier, e.g. gmail_refresh_token, gmail_access_token';
COMMENT ON COLUMN public.user_settings.setting_value IS 'Encrypted value (use PGP encryption in production)';
COMMENT ON COLUMN public.user_settings.metadata IS 'Additional data: expires_at, scopes, email_address, etc.';
