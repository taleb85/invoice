-- Fix: cancella anche i documenti con data_documento antecedente al FY 2025/26
-- (created_at è recente perché importati dopo, ma la data documento è del 2023/2024)

DELETE FROM public.documenti_da_processare
WHERE data_documento IS NOT NULL
  AND data_documento < '2025-04-06'::date;

SELECT pg_notify('pgrst', 'reload schema');
