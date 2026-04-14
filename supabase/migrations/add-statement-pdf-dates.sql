-- Optional header dates extracted from statement PDF (issued / last payment, etc.)
ALTER TABLE public.statements
  ADD COLUMN IF NOT EXISTS extracted_pdf_dates jsonb;

COMMENT ON COLUMN public.statements.extracted_pdf_dates IS
  'JSON e.g. {"issued_date":"2025-05-19","last_payment_date":"2025-04-16"} from OCR; separate from received_at.';
