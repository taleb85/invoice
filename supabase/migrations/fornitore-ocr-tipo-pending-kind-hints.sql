-- Apprendimento: per ogni fornitore, tipo documento OCR (fattura/bolla/altro/unknown) → categoria in coda (pending_kind).

CREATE TABLE IF NOT EXISTS public.fornitore_ocr_tipo_pending_kind_hints (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornitore_id    uuid NOT NULL REFERENCES public.fornitori(id) ON DELETE CASCADE,
  ocr_tipo_key    text NOT NULL,
  pending_kind    text NOT NULL CHECK (pending_kind IN ('statement', 'bolla', 'fattura', 'ordine')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fornitore_id, ocr_tipo_key)
);

CREATE INDEX IF NOT EXISTS idx_fornitore_ocr_hint_fornitore
  ON public.fornitore_ocr_tipo_pending_kind_hints (fornitore_id);

COMMENT ON TABLE public.fornitore_ocr_tipo_pending_kind_hints IS
  'Mappa appresa: tipo_documento OCR (per fornitore) → categoria documento in coda (estratto/bolla/fattura/ordine).';

ALTER TABLE public.fornitore_ocr_tipo_pending_kind_hints ENABLE ROW LEVEL SECURITY;
