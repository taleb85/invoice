-- Alcuni file_url salvati con newline dentro l'URL (es. dopo .supabase.co) impediscono
-- download/OCR. Rimuove CR/LF da tutte le colonne file_url note.

UPDATE bolle
SET file_url = regexp_replace(file_url, E'[\\n\\r]+', '', 'g')
WHERE file_url ~ E'[\\n\\r]';

UPDATE fatture
SET file_url = regexp_replace(file_url, E'[\\n\\r]+', '', 'g')
WHERE file_url ~ E'[\\n\\r]';

UPDATE documenti_da_processare
SET file_url = regexp_replace(file_url, E'[\\n\\r]+', '', 'g')
WHERE file_url ~ E'[\\n\\r]';

UPDATE conferme_ordine
SET file_url = regexp_replace(file_url, E'[\\n\\r]+', '', 'g')
WHERE file_url ~ E'[\\n\\r]';

UPDATE statements
SET file_url = regexp_replace(file_url, E'[\\n\\r]+', '', 'g')
WHERE file_url ~ E'[\\n\\r]';

UPDATE log_sincronizzazione
SET file_url = regexp_replace(file_url, E'[\\n\\r]+', '', 'g')
WHERE file_url ~ E'[\\n\\r]';
