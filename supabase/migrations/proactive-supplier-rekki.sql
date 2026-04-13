-- Proactive supplier hints, Rekki mapping, sender↔supplier association memory
-- Safe to run multiple times (IF NOT EXISTS / DROP IF EXISTS).

-- 1) Log sync: stato "fornitore_suggerito" (OCR ha trovato anagrafica non in rubrica)
ALTER TABLE public.log_sincronizzazione
  DROP CONSTRAINT IF EXISTS log_sincronizzazione_stato_check;

ALTER TABLE public.log_sincronizzazione
  ADD CONSTRAINT log_sincronizzazione_stato_check
  CHECK (stato IN (
    'successo',
    'fornitore_non_trovato',
    'bolla_non_trovata',
    'fornitore_suggerito'
  ));

-- 2) Fornitori: Rekki + indirizzo (estrazione OCR / anagrafica)
ALTER TABLE public.fornitori
  ADD COLUMN IF NOT EXISTS rekki_link text;

ALTER TABLE public.fornitori
  ADD COLUMN IF NOT EXISTS indirizzo text;

COMMENT ON COLUMN public.fornitori.rekki_link IS 'URL Rekki (ordini / confronto prezzi) per questo fornitore.';
COMMENT ON COLUMN public.fornitori.indirizzo IS 'Sede legale o operativa, opzionale (es. da OCR).';

-- 3) Conteggio associazioni manuali mittente → fornitore (proposta "ricorda")
CREATE TABLE IF NOT EXISTS public.mittente_fornitore_assoc_stats (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mittente_email     text NOT NULL,
  fornitore_id       uuid NOT NULL REFERENCES public.fornitori(id) ON DELETE CASCADE,
  association_count  int NOT NULL DEFAULT 1,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mittente_email, fornitore_id)
);

CREATE INDEX IF NOT EXISTS idx_mittente_assoc_fornitore
  ON public.mittente_fornitore_assoc_stats (fornitore_id);

CREATE INDEX IF NOT EXISTS idx_mittente_assoc_email
  ON public.mittente_fornitore_assoc_stats (lower(mittente_email));

ALTER TABLE public.mittente_fornitore_assoc_stats ENABLE ROW LEVEL SECURITY;

-- Solo service role / backend (nessuna policy authenticated = negato per JWT)
