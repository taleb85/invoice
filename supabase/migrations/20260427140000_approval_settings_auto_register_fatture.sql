-- Optional: automatically register OCR-confident invoices without manual confirmation (client-gated).
ALTER TABLE public.approval_settings
  ADD COLUMN IF NOT EXISTS auto_register_fatture boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.approval_settings.auto_register_fatture IS
  'When true, invoices in the pending queue that satisfy AI confidence gates may register without manual confirmation.';
