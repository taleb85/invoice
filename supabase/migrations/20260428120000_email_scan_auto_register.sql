-- Stato coda: documenti da revisionare manualmente (solo email OCR / fornitore o tipo incerti)
ALTER TABLE public.documenti_da_processare
  DROP CONSTRAINT IF EXISTS documenti_da_processare_stato_check;

ALTER TABLE public.documenti_da_processare
  ADD CONSTRAINT documenti_da_processare_stato_check
  CHECK (stato IN (
    'in_attesa',
    'da_associare',
    'associato',
    'scartato',
    'bozza_creata',
    'da_revisionare'
  ));

COMMENT ON COLUMN public.documenti_da_processare.stato IS
  'da_revisionare = richiede revisione (fornitore sconosciuto o tipo documento ambiguo da email).';

-- Tracciamento salvataggi automatici da scansione email (badge + KPI "oggi")
ALTER TABLE public.fatture
  ADD COLUMN IF NOT EXISTS email_sync_auto_saved_at timestamptz;

COMMENT ON COLUMN public.fatture.email_sync_auto_saved_at IS
  'Impostato quando la fattura è creata automaticamente dalla scansione email OCR.';

ALTER TABLE public.bolle
  ADD COLUMN IF NOT EXISTS email_sync_auto_saved_at timestamptz;

COMMENT ON COLUMN public.bolle.email_sync_auto_saved_at IS
  'Impostato quando la bolla è creata automaticamente dalla scansione email OCR.';
