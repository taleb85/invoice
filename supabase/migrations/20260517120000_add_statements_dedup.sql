-- Migration: Statement deduplication enforcement
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS everywhere.

-- ── 1. Remove duplicates from statements table ────────────────────────────────
-- Keep only the latest row per (sede_id, file_url) pair
DELETE FROM public.statements
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY COALESCE(sede_id, '00000000-0000-0000-0000-000000000000'::uuid),
                   COALESCE(file_url, '')
      ORDER BY created_at DESC
    ) AS rn
    FROM public.statements
  ) dup
  WHERE dup.rn > 1
);

-- ── 2. Remove orphaned statement_rows that reference deleted statements ───────
DELETE FROM public.statement_rows
WHERE statement_id NOT IN (SELECT id FROM public.statements);

-- ── 3. Add UNIQUE partial index to prevent future duplicates ──────────────────
-- Only applies when file_url IS NOT NULL (rows with NULL file_url are ignored)
DROP INDEX IF EXISTS idx_statements_sede_file_url_unique;
CREATE UNIQUE INDEX idx_statements_sede_file_url_unique
  ON public.statements (sede_id, file_url)
  WHERE file_url IS NOT NULL;

COMMENT ON INDEX idx_statements_sede_file_url_unique IS
  'Prevents duplicate statement processing for the same file in the same branch.';

-- ── Force PostgREST to reload its schema cache ────────────────────────────────
SELECT pg_notify('pgrst', 'reload schema');
