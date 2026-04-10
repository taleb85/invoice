-- Aggiunge colonna "registrato_da" alla tabella bolle
-- Da eseguire in Supabase SQL Editor

ALTER TABLE public.bolle
  ADD COLUMN IF NOT EXISTS registrato_da text;
