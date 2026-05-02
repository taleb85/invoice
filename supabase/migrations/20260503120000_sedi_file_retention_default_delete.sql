-- Allegati: nessuna policy «keep» — default ed esistenti passano a eliminazione da storage oltre la soglia.
UPDATE public.sedi
SET
  file_retention_policy = 'delete_only',
  file_retention_months = COALESCE(file_retention_months, 12),
  file_retention_run_day = COALESCE(file_retention_run_day, 1)
WHERE file_retention_policy = 'keep';

ALTER TABLE public.sedi
  ALTER COLUMN file_retention_policy SET DEFAULT 'delete_only';

COMMENT ON COLUMN public.sedi.file_retention_policy IS 'keep=legacy non usato in UI; delete_only=rimuovi file oltre N mesi (solo storage); archive_then_delete=export/ZIP manuale o job poi stessa rimozione.';
