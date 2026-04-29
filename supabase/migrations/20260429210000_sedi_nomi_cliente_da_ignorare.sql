-- Nomi intestatario cliente (destinatario fatture) da non confondere con il fornitore in OCR.
-- Configurabili da UI impostazioni sede senza deploy.

ALTER TABLE public.sedi
  ADD COLUMN IF NOT EXISTS nomi_cliente_da_ignorare text[]
  DEFAULT ARRAY[
    'Osteria Basilico',
    'Eurogold Restaurant Ltd',
    'Eurogold Restaurant',
    'Eurogold',
    'Basilico Restaurant'
  ]::text[];

COMMENT ON COLUMN public.sedi.nomi_cliente_da_ignorare IS
  'Nomi del cliente/destinatario: non usare come ragione_sociale fornitore in OCR; unire al prompt e post-filter.';
