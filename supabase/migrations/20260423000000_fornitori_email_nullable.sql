-- Rende la colonna email opzionale nella tabella fornitori.
-- Il client invia già null quando il campo è vuoto; bloccava solo il vincolo DB.
-- L'indice lower(email) continua a funzionare: PostgreSQL non indicizza le righe NULL.

ALTER TABLE public.fornitori ALTER COLUMN email DROP NOT NULL;
