-- Migration: Remove all data before the start of fiscal year 2025/2026
-- UK fiscal year 2025/2026 starts on 6 April 2025.
-- Safe to re-run: uses idempotent DELETE with WHERE clauses.

-- ── 1. statement_rows (FK to statements) ────────────────────────────────
DELETE FROM public.statement_rows
WHERE statement_id IN (
  SELECT id FROM public.statements WHERE created_at < '2025-04-06'::timestamptz
);

-- ── 2. statements ───────────────────────────────────────────────────────
DELETE FROM public.statements
WHERE created_at < '2025-04-06'::timestamptz;

-- ── 3. ai_usage_log ─────────────────────────────────────────────────────
DELETE FROM public.ai_usage_log
WHERE created_at < '2025-04-06'::timestamptz;

-- ── 4. activity_log ─────────────────────────────────────────────────────
DELETE FROM public.activity_log
WHERE created_at < '2025-04-06'::timestamptz;

-- ── 5. price_anomalies ──────────────────────────────────────────────────
DELETE FROM public.price_anomalies
WHERE created_at < '2025-04-06'::timestamptz;

-- ── 6. listino_prezzi ───────────────────────────────────────────────────
DELETE FROM public.listino_prezzi
WHERE data_prezzo < '2025-04-06'::date;

-- ── 7. conferme_ordine ──────────────────────────────────────────────────
DELETE FROM public.conferme_ordine
WHERE created_at < '2025-04-06'::timestamptz;

-- ── 8. documenti_da_processare ──────────────────────────────────────────
-- Cancella sia per created_at (importazione) che per data_documento (data documento effettiva)
DELETE FROM public.documenti_da_processare
WHERE created_at < '2025-04-06'::timestamptz
   OR (data_documento IS NOT NULL AND data_documento < '2025-04-06'::date);

-- ── 9. log_sincronizzazione ─────────────────────────────────────────────
DELETE FROM public.log_sincronizzazione
WHERE data < '2025-04-06'::timestamptz;

-- ── 10. fatture ──────────────────────────────────────────────────────────
DELETE FROM public.fatture
WHERE data < '2025-04-06'::date;

-- ── 11. bolle ────────────────────────────────────────────────────────────
DELETE FROM public.bolle
WHERE data < '2025-04-06'::date;

-- ── 12. rekki_price_history (se tabella esiste) ───────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'rekki_price_history' AND relnamespace = 'public'::regnamespace) THEN
    DELETE FROM public.rekki_price_history WHERE data_prezzo < '2025-04-06'::date;
    RAISE NOTICE 'rekki_price_history cleaned';
  END IF;
END $$;

-- ── 13. fornitore_ocr_tipo_pending_kind_hints ─────────────────────────────
DELETE FROM public.fornitore_ocr_tipo_pending_kind_hints
WHERE created_at < '2025-04-06'::timestamptz;

-- Force PostgREST to reload its schema cache
SELECT pg_notify('pgrst', 'reload schema');
