-- Conservazione allegati: policy per azienda (sede). Il job automatico mensile va configurato separatamente (cron / script).
ALTER TABLE public.sedi
  ADD COLUMN IF NOT EXISTS file_retention_policy text NOT NULL DEFAULT 'keep'
    CHECK (file_retention_policy IN ('keep', 'delete_only', 'archive_then_delete')),
  ADD COLUMN IF NOT EXISTS file_retention_months integer
    CHECK (file_retention_months IS NULL OR (file_retention_months >= 1 AND file_retention_months <= 120)),
  ADD COLUMN IF NOT EXISTS file_retention_run_day smallint
    CHECK (file_retention_run_day IS NULL OR (file_retention_run_day >= 1 AND file_retention_run_day <= 28));

COMMENT ON COLUMN public.sedi.file_retention_policy IS 'keep=tutti gli allegati; delete_only=rimuovi file oltre N mesi (solo storage, valori restano in DB); archive_then_delete=prima export manuale / ZIP pianificato poi stessa rimozione.';
COMMENT ON COLUMN public.sedi.file_retention_months IS 'Età massima allegati in mesi dalla data documento (soglia quando policy ≠ keep).';
COMMENT ON COLUMN public.sedi.file_retention_run_day IS 'Giorno del mese (1–28) previsto per esecuzione job di purge.';
