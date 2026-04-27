-- ============================================================
-- add-ai-metadata.sql
-- Eseguire nel SQL Editor di Supabase
-- ============================================================
-- Aggiunge la colonna metadata (jsonb) a documenti_da_processare
-- per memorizzare i dati estratti dall'AI (OCR):
--   ragione_sociale, p_iva, data_fattura, numero_fattura,
--   totale_iva_inclusa, matched_by
--
-- Aggiunge anche un indice sulla colonna piva di fornitori
-- per velocizzare il matching intelligente via P.IVA.
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. Colonna metadata jsonb su documenti_da_processare
-- ──────────────────────────────────────────────────────────────
alter table public.documenti_da_processare
  add column if not exists metadata jsonb;

comment on column public.documenti_da_processare.metadata is
  'Dati estratti via OCR/AI: {ragione_sociale, p_iva, data_fattura, numero_fattura, totale_iva_inclusa, matched_by}';


-- ──────────────────────────────────────────────────────────────
-- 2. Indice GIN per query veloci sul jsonb (es. filtro per piva)
-- ──────────────────────────────────────────────────────────────
create index if not exists idx_documenti_metadata
  on public.documenti_da_processare using gin (metadata);


-- ──────────────────────────────────────────────────────────────
-- 3. Indice sulla colonna piva di fornitori
--    (velocizza resolveFornitoreByPIVA)
-- ──────────────────────────────────────────────────────────────
create index if not exists idx_fornitori_piva
  on public.fornitori (lower(piva));


-- ──────────────────────────────────────────────────────────────
-- 4. Assicurati che le API key siano nelle variabili d'ambiente
--    NON nel DB. Questa query serve solo come reminder.
-- ──────────────────────────────────────────────────────────────
-- Variabili richieste in .env.local (mai nel codice sorgente):
--   GEMINI_API_KEY=AI...
--   SUPABASE_SERVICE_ROLE_KEY=eyJ...
--   CRON_SECRET=...
-- ============================================================
