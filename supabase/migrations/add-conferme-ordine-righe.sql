-- Aggiunge colonna righe (prodotti) alle conferme d'ordine Rekki.
ALTER TABLE public.conferme_ordine
  ADD COLUMN IF NOT EXISTS righe jsonb;

COMMENT ON COLUMN public.conferme_ordine.righe IS
  'Righe prodotto estratte automaticamente dall''email Rekki: [{prodotto, quantita, prezzo_unitario, importo_linea}]';
