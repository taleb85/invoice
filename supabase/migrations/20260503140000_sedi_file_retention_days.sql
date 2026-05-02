-- Età allegati in giorni (soglia fissa lato prodotto: 45). `file_retention_months` resta in schema ma non è più usato dall’app.
ALTER TABLE public.sedi
  ADD COLUMN IF NOT EXISTS file_retention_days integer NOT NULL DEFAULT 45
    CHECK (file_retention_days >= 1 AND file_retention_days <= 3650);

UPDATE public.sedi SET file_retention_days = 45;

COMMENT ON COLUMN public.sedi.file_retention_days IS 'Giorni dalla data documento oltre i quali gli allegati possono essere eliminati dallo storage (valori in DB restano).';
COMMENT ON COLUMN public.sedi.file_retention_months IS 'Legacy: non più usato dall’app; usare file_retention_days.';
