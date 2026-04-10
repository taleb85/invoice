-- ============================================================
-- add-statement-column.sql
-- Eseguire nel SQL Editor di Supabase
-- ============================================================
-- Aggiunge il flag is_statement a documenti_da_processare
-- per contrassegnare un file come "Monthly Statement".
-- Questa colonna è opzionale: senza di essa il flag viene
-- gestito solo in memoria (sessione browser).
-- ============================================================

alter table public.documenti_da_processare
  add column if not exists is_statement boolean not null default false;

-- Indice per ricerche rapide sugli statement
create index if not exists idx_documenti_is_statement
  on public.documenti_da_processare (is_statement, fornitore_id)
  where is_statement = true;
