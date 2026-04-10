-- ============================================================
-- fix-documenti-visibilita.sql  (MIGRAZIONE COMPLETA)
-- DA ESEGUIRE NEL SQL EDITOR DI SUPABASE
--
-- Risolve tutti i problemi che impediscono il salvataggio e la
-- visualizzazione dei documenti ricevuti via email.
--
-- PROBLEMA 1 — Colonne mancanti (metadata, is_statement)
--   Le colonne aggiunte da migrazioni successive potrebbero non
--   essere ancora presenti nel database, causando errori 42703.
--
-- PROBLEMA 2 — CHECK constraint troppo restrittivo
--   La colonna `stato` accettava solo ('in_attesa','associato',
--   'scartato'). Il nuovo stato 'da_associare' viene rifiutato
--   silenziosamente da PostgreSQL, causando il fallimento di
--   tutti gli insert da scan-emails.
--
-- PROBLEMA 3 — RLS con NULL invisibile
--   La policy SELECT usava "sede_id = get_user_sede()".
--   In SQL, NULL = <qualsiasi valore> restituisce NULL (non TRUE),
--   quindi i documenti con sede_id = NULL (global IMAP, mittente
--   sconosciuto) sono completamente invisibili agli operatori.
-- ============================================================


-- ── PARTE 1: Colonne mancanti ─────────────────────────────────
-- Aggiunge metadata e is_statement solo se non esistono già

ALTER TABLE public.documenti_da_processare
  ADD COLUMN IF NOT EXISTS metadata jsonb;

ALTER TABLE public.documenti_da_processare
  ADD COLUMN IF NOT EXISTS is_statement boolean NOT NULL DEFAULT false;

-- Indici per le nuove colonne (idempotenti)
CREATE INDEX IF NOT EXISTS idx_documenti_metadata
  ON public.documenti_da_processare USING gin (metadata);

CREATE INDEX IF NOT EXISTS idx_documenti_is_statement
  ON public.documenti_da_processare (is_statement, fornitore_id)
  WHERE is_statement = true;


-- ── PARTE 2: CHECK constraint ─────────────────────────────────
-- Rimuovi il vecchio constraint e ricrealo includendo 'da_associare'

ALTER TABLE public.documenti_da_processare
  DROP CONSTRAINT IF EXISTS documenti_da_processare_stato_check;

ALTER TABLE public.documenti_da_processare
  ADD CONSTRAINT documenti_da_processare_stato_check
  CHECK (stato IN ('in_attesa', 'da_associare', 'associato', 'scartato'));


-- ── PARTE 3: RLS — documenti_da_processare ────────────────────
-- Aggiorna SELECT e UPDATE per rendere visibili i documenti con
-- sede_id = NULL (da global IMAP o mittente senza sede assegnata)

DROP POLICY IF EXISTS "documenti_processare: select" ON public.documenti_da_processare;
CREATE POLICY "documenti_processare: select" ON public.documenti_da_processare
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR sede_id = public.get_user_sede()
    OR sede_id IS NULL    -- documenti da global IMAP o mittente sconosciuto
  );

DROP POLICY IF EXISTS "documenti_processare: insert" ON public.documenti_da_processare;
CREATE POLICY "documenti_processare: insert" ON public.documenti_da_processare
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR sede_id = public.get_user_sede()
    OR sede_id IS NULL
  );

DROP POLICY IF EXISTS "documenti_processare: update" ON public.documenti_da_processare;
CREATE POLICY "documenti_processare: update" ON public.documenti_da_processare
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR sede_id = public.get_user_sede()
    OR sede_id IS NULL
  );

DROP POLICY IF EXISTS "documenti_processare: delete" ON public.documenti_da_processare;
CREATE POLICY "documenti_processare: delete" ON public.documenti_da_processare
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR sede_id = public.get_user_sede()
    OR sede_id IS NULL
  );


-- ── PARTE 4 (opzionale): Backfill dei record esistenti ────────
-- Se vuoi che i vecchi documenti con sede_id = NULL vengano
-- assegnati alla prima sede disponibile, decommenta il blocco:
--
-- DO $$
-- DECLARE v_sede UUID;
-- BEGIN
--   SELECT id INTO v_sede FROM public.sedi ORDER BY created_at LIMIT 1;
--   IF v_sede IS NOT NULL THEN
--     UPDATE public.documenti_da_processare
--       SET sede_id = v_sede
--       WHERE sede_id IS NULL;
--     RAISE NOTICE 'Backfill completato: % record aggiornati', ROW_COUNT();
--   END IF;
-- END $$;
