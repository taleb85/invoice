-- Allinea document_date al periodo estratto dal PDF (issued_date / last_payment_date)
-- invece di date errate di scansione/elaborazione.
UPDATE public.statements
SET document_date = COALESCE(
  NULLIF(trim(extracted_pdf_dates->>'issued_date'), ''),
  NULLIF(trim(extracted_pdf_dates->>'last_payment_date'), ''),
  document_date
)
WHERE extracted_pdf_dates IS NOT NULL
  AND (
    NULLIF(trim(extracted_pdf_dates->>'issued_date'), '') IS NOT NULL
    OR NULLIF(trim(extracted_pdf_dates->>'last_payment_date'), '') IS NOT NULL
  );
