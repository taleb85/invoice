-- Aggiorna default e righe esistenti: Mediterraneo Restaurant (brand nella stessa organizzazione).
ALTER TABLE public.sedi
  ALTER COLUMN nomi_cliente_da_ignorare SET DEFAULT ARRAY[
    'Osteria Basilico',
    'Eurogold Restaurant Ltd',
    'Eurogold Restaurant',
    'Eurogold',
    'Basilico Restaurant',
    'Mediterraneo Restaurant'
  ]::text[];

UPDATE public.sedi s
SET nomi_cliente_da_ignorare = (
  SELECT ARRAY(
    SELECT DISTINCT u
    FROM unnest(coalesce(s.nomi_cliente_da_ignorare, '{}'::text[]) || ARRAY['Mediterraneo Restaurant'::text]) AS u
  )
)
WHERE NOT ('Mediterraneo Restaurant'::text = ANY(coalesce(s.nomi_cliente_da_ignorare, '{}'::text[])));
