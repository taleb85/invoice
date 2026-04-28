-- Blacklist mittenti OCR (skip senza log). Tabella può già esistere in progetti esistenti: idempotenza.

CREATE TABLE IF NOT EXISTS public.email_scan_blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID NOT NULL REFERENCES public.sedi (id) ON DELETE CASCADE,
  mittente TEXT NOT NULL,
  motivo TEXT NOT NULL CHECK (
    motivo IN ('newsletter', 'spam', 'non_fornitore', 'sistema', 'social')
  ),
  aggiunto_da UUID REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (sede_id, mittente)
);

CREATE INDEX IF NOT EXISTS email_scan_blacklist_sede_id_created_at_idx
  ON public.email_scan_blacklist (sede_id, created_at DESC);

ALTER TABLE public.email_scan_blacklist ENABLE ROW LEVEL SECURITY;
