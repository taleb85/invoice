-- Regole operative per scarto automatico in scan email (Gemini OCR pipeline).
CREATE TABLE IF NOT EXISTS public.ocr_scarto_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sede_id UUID NOT NULL REFERENCES public.sedi (id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (
    tipo = ANY (
      ARRAY['mittente'::text, 'dominio'::text, 'parola_chiave'::text, 'tipo_documento'::text]
    )
  ),
  valore TEXT NOT NULL,
  motivo TEXT,
  attivo BOOLEAN NOT NULL DEFAULT TRUE,
  creato_da UUID REFERENCES auth.users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ocr_scarto_rules_sede_attivo ON public.ocr_scarto_rules (sede_id, attivo);

COMMENT ON TABLE public.ocr_scarto_rules IS
  'Regole per-scarto documenti durante scan IMAP OCR; valori valutati prima (mittente/dominio/keyword PDF) o dopo classificazione Gemini (tipo_documento).';
