-- =============================================================================
-- Reset stato scan email (coda + checkpoint) — da eseguire in Supabase SQL Editor
-- =============================================================================
-- Dopo l’esecuzione:
-- 1. Avvia la sincronizzazione dalla dashboard (pulsante scan email) o da Log.
--    Lo scan IMAP considera le mail nella finestra (giorni / anno fiscale), lette e non lette;
--    senza le righe di log sotto, gli allegati possono essere rielaborati se ancora in casella.
--
-- Nota: i file già caricati su Storage (bucket documenti) restano; puoi pulirli a mano
-- se ti servono meno oggetti orfani.
-- =============================================================================

BEGIN;

-- Coda “Documenti da elaborare”
DELETE FROM public.documenti_da_processare;

-- Checkpoint idempotenza: senza queste righe lo stesso allegato può essere rielaborato
-- (se lo scan viene rilanciato e il messaggio è ancora nella finestra IMAP).
DELETE FROM public.log_sincronizzazione
WHERE scan_attachment_fingerprint IS NOT NULL;

COMMIT;

-- Per svuotare anche tutto il log, fatture, bolle e fornitori (ordine obbligatorio per i FK):
-- BEGIN;
-- DELETE FROM public.documenti_da_processare;
-- DELETE FROM public.log_sincronizzazione;
-- DELETE FROM public.fatture;
-- DELETE FROM public.bolle;
-- DELETE FROM public.fornitori;
-- COMMIT;

-- -----------------------------------------------------------------------------
-- OPZIONALE — solo se vuoi eliminare anche le bolle automatiche in bozza
-- (non tocca fatture: quelle da scan non hanno uno stato "bozza" dedicato in DB).
-- Scommenta e riesegui in una nuova transazione se ti serve.
-- -----------------------------------------------------------------------------
-- BEGIN;
-- DELETE FROM public.bolle WHERE stato = 'bozza';
-- COMMIT;
