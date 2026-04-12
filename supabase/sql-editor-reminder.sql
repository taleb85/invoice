-- =============================================================================
-- PROMEMORIA PER SUPABASE SQL EDITOR (sintassi PostgreSQL valida)
-- =============================================================================
-- Questo file NON sostituisce le migration: contiene solo commenti + una query
-- innocua. Puoi incollarlo tutto nell'editor per verificare che non dia errori.
--
-- NON incollare MAI file Markdown (.md) come DEPLOY_GUIDE.md: iniziano con "#"
-- e PostgreSQL restituisce: ERROR: syntax error at or near "#"
--
-- Per ogni voce sotto: apri il file .sql nel repository, copia SOLO il contenuto
-- SQL, incollalo nell'editor, Run. Poi passa al file successivo.
-- =============================================================================

SELECT 1 AS ok_editor_pronto;

-- ----- Fase A (radice del repo, salvo diversa indicazione) -----
-- 1.  multi-sede.sql
-- 2.  create-log-table.sql
-- 3.  security-and-performance.sql
-- 4.  setup-storage.sql
-- 5.  security-update.sql

-- ----- Fase B (radice del repo) -----
-- 6.  add-country-code.sql
-- 7.  add-da-associare-stato.sql
-- 8.  fix-documenti-visibilita.sql
-- 9.  fix-rls-null-sede.sql
-- 10. add-importo-multibolla.sql
-- 11. add-fornitore-emails.sql
-- 12. add-fornitore-display-name.sql
-- 13. add-ai-metadata.sql
-- 14. add-statement-column.sql
-- 15. add-registrato-da.sql
-- 16. sedi-imap.sql

-- ----- Fase C (cartella migrations/) -----
-- 17. migrations/listino_prezzi.sql
-- 18. migrations/fornitore_contatti.sql
-- 19. migrations/add-imap-lookback-days.sql

-- ----- Fase D (cartella supabase/migrations/) -----
-- 20. supabase/migrations/add-statements.sql
-- 21. supabase/migrations/add-rekki-statement-status.sql
-- 22. supabase/migrations/add-sede-currency-timezone-lang.sql
-- 23. supabase/migrations/add-fornitore-display-name.sql  (solo se non hai fatto 12)
