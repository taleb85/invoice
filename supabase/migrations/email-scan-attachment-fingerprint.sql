-- Idempotenza scan email: ripresa dopo timeout senza ri-OCR sullo stesso allegato
ALTER TABLE public.log_sincronizzazione
  ADD COLUMN IF NOT EXISTS imap_uid bigint,
  ADD COLUMN IF NOT EXISTS scan_attachment_fingerprint text;

CREATE INDEX IF NOT EXISTS idx_log_scan_fingerprint
  ON public.log_sincronizzazione (scan_attachment_fingerprint)
  WHERE scan_attachment_fingerprint IS NOT NULL;

COMMENT ON COLUMN public.log_sincronizzazione.imap_uid IS 'UID messaggio IMAP al momento dello scan (debug / correlazione).';
COMMENT ON COLUMN public.log_sincronizzazione.scan_attachment_fingerprint IS 'Chiave stabile per unità di lavoro (sede+uid+nome+hash) — evita duplicati su retry.';
