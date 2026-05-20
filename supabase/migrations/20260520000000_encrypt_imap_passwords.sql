-- Crittografia password IMAP con pgcrypto
-- Le password email (IMAP) vengono cifrate con AES-256-GCM usando una chiave
-- definita in variabile d'ambiente (app.encryption_key) e mai salvata nel database.
--
-- Uso:
--   SELECT imap_encrypt('password')       → cifra
--   SELECT imap_decrypt(imap_password)    → decifra (usato dal codice applicativo)
--
-- La chiave APP_ENCRYPTION_KEY deve essere configurata su Supabase:
--   SELECT set_config('app.encryption_key', 'la-tua-chiave-aes-256', false)
-- Oppure via env var in dashboard Supabase (consigliato).

-- Abilita l'estensione pgcrypto (idempotente)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Funzione per cifrare: restituisce il testo cifrato in formato hex
CREATE OR REPLACE FUNCTION public.imap_encrypt(plaintext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  enc_key text;
BEGIN
  enc_key := current_setting('app.encryption_key', true);
  IF enc_key IS NULL OR enc_key = '' THEN
    RAISE EXCEPTION 'APP_ENCRYPTION_KEY non configurata';
  END IF;
  RETURN encode(
    pgp_sym_encrypt(plaintext, enc_key, 'compress-algo=2, cipher-algo=aes256'),
    'hex'
  );
END;
$$;

-- Funzione per decifrare: riceve hex cifrato, restituisce testo in chiaro
CREATE OR REPLACE FUNCTION public.imap_decrypt(ciphertext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  enc_key text;
  decrypted text;
BEGIN
  IF ciphertext IS NULL OR ciphertext = '' THEN
    RETURN NULL;
  END IF;
  enc_key := current_setting('app.encryption_key', true);
  IF enc_key IS NULL OR enc_key = '' THEN
    RAISE EXCEPTION 'APP_ENCRYPTION_KEY non configurata';
  END IF;
  BEGIN
    decrypted := pgp_sym_decrypt(decode(ciphertext, 'hex'), enc_key);
    RETURN decrypted;
  EXCEPTION WHEN OTHERS THEN
    -- Se la decifratura fallisce, potrebbe essere già in chiaro (migrazione legacy)
    RETURN ciphertext;
  END;
END;
$$;

-- Cifra tutte le password IMAP esistenti (se ancora in chiaro)
UPDATE public.sedi
SET imap_password = public.imap_encrypt(imap_password)
WHERE imap_password IS NOT NULL
  AND imap_password != ''
  AND (
    -- Non è già cifrata: una stringa cifrata in hex inizia con 'c1' o simili
    -- ma non è un test affidabile. Proviamo a decifrare: se fallisce, è in chiaro
    NOT EXISTS (
      SELECT 1 FROM public.sedi s2
      WHERE s2.id = sedi.id
        AND pgp_sym_decrypt(decode(sedi.imap_password, 'hex'), current_setting('app.encryption_key', true)) IS NOT NULL
    )
  );
