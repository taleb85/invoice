-- Dopo purge retention gli allegati vengono rimossi dallo storage; file_url può essere NULL.
ALTER TABLE public.fatture ALTER COLUMN file_url DROP NOT NULL;
ALTER TABLE public.bolle ALTER COLUMN file_url DROP NOT NULL;
ALTER TABLE public.documenti_da_processare ALTER COLUMN file_url DROP NOT NULL;
ALTER TABLE public.conferme_ordine ALTER COLUMN file_url DROP NOT NULL;
