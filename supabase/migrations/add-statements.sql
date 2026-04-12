-- Migration: Automatic Statement inbox
-- Safe to re-run: uses IF NOT EXISTS / DROP IF EXISTS everywhere.
-- Run this in Supabase Dashboard → SQL Editor

-- ── Create tables (if they don't exist yet) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.statements (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sede_id       uuid REFERENCES public.sedi(id) ON DELETE CASCADE,
  fornitore_id  uuid REFERENCES public.fornitori(id) ON DELETE SET NULL,
  file_url      text,
  created_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.statement_rows (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  statement_id  uuid NOT NULL REFERENCES public.statements(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now()
);

-- ── Add missing columns (safe when table already exists) ─────────────────────
ALTER TABLE public.statements
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS received_at   timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS status        text DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS total_rows    int  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS missing_rows  int  DEFAULT 0;

-- Add CHECK constraint only if not already present (idempotent via DO block)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'statements_status_check' AND conrelid = 'public.statements'::regclass
  ) THEN
    ALTER TABLE public.statements
      ADD CONSTRAINT statements_status_check
      CHECK (status IN ('processing','done','error'));
  END IF;
END $$;

ALTER TABLE public.statement_rows
  ADD COLUMN IF NOT EXISTS numero_doc     text,
  ADD COLUMN IF NOT EXISTS importo        numeric(12,2),
  ADD COLUMN IF NOT EXISTS data_doc       date,
  ADD COLUMN IF NOT EXISTS check_status   text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS fattura_id     uuid REFERENCES public.fatture(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delta_importo  numeric(12,2),
  ADD COLUMN IF NOT EXISTS fornitore_id   uuid REFERENCES public.fornitori(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fattura_numero text,
  ADD COLUMN IF NOT EXISTS bolle_json     jsonb;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'statement_rows_check_status_check' AND conrelid = 'public.statement_rows'::regclass
  ) THEN
    ALTER TABLE public.statement_rows
      ADD CONSTRAINT statement_rows_check_status_check
      CHECK (check_status IN ('pending','ok','fattura_mancante','bolle_mancanti','errore_importo'));
  END IF;
END $$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.statements      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_rows  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stmt_select"  ON public.statements;
DROP POLICY IF EXISTS "stmt_write"   ON public.statements;
DROP POLICY IF EXISTS "srow_select"  ON public.statement_rows;
DROP POLICY IF EXISTS "srow_write"   ON public.statement_rows;

CREATE POLICY "stmt_select"  ON public.statements     FOR SELECT USING (auth.role() IN ('authenticated','service_role'));
CREATE POLICY "stmt_write"   ON public.statements     FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "srow_select"  ON public.statement_rows FOR SELECT USING (auth.role() IN ('authenticated','service_role'));
CREATE POLICY "srow_write"   ON public.statement_rows FOR ALL    USING (auth.role() = 'service_role');

-- ── Force PostgREST to reload its schema cache ────────────────────────────────
SELECT pg_notify('pgrst', 'reload schema');
