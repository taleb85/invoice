-- Retention allegati: mese corrente + precedente; job cron /api/cron/purge-file-retention (giorno 5).
UPDATE public.sedi
SET
  file_retention_policy = COALESCE(NULLIF(file_retention_policy, 'keep'), 'delete_only'),
  file_retention_run_day = COALESCE(file_retention_run_day, 5)
WHERE file_retention_policy IS NULL
   OR file_retention_policy = 'keep'
   OR file_retention_run_day IS NULL;

COMMENT ON COLUMN public.sedi.file_retention_days IS
  'Legacy (giorni): non usato dal job purge — soglia = mesi calendario (mese corrente + precedente).';
