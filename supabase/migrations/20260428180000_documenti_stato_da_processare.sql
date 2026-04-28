-- Allinea stati documenti_da_processare a: da_processare, da_associare, bozza_creata, associato, scartato, da_revisionare
-- Migra legacy in_attesa → da_processare

ALTER TABLE public.documenti_da_processare
  DROP CONSTRAINT IF EXISTS documenti_da_processare_stato_check;

UPDATE public.documenti_da_processare
  SET stato = 'da_processare'
  WHERE stato = 'in_attesa';

ALTER TABLE public.documenti_da_processare
  ADD CONSTRAINT documenti_da_processare_stato_check
  CHECK (stato IN (
    'da_processare',
    'da_associare',
    'bozza_creata',
    'associato',
    'scartato',
    'da_revisionare'
  ));

COMMENT ON COLUMN public.documenti_da_processare.stato IS
  'Coda documenti: da_processare (nuovo/legacy in_attesa), da_associare, bozza_creata, associato, scartato, da_revisionare.';
