-- CV / resume / allegati non fiscalmente rilevanti — chiude fingerprint senza trattarli come errore fornitore.
ALTER TABLE public.log_sincronizzazione
  DROP CONSTRAINT IF EXISTS log_sincronizzazione_stato_check;

ALTER TABLE public.log_sincronizzazione
  ADD CONSTRAINT log_sincronizzazione_stato_check
  CHECK (stato IN (
    'successo',
    'fornitore_non_trovato',
    'bolla_non_trovata',
    'fornitore_suggerito',
    'documento_non_fiscale'
  ));

COMMENT ON COLUMN public.log_sincronizzazione.stato IS
  'Esito elaborate email: incluso documento_non_fiscale (es. curriculum/CV senza ingresso in coda).';
