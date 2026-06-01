-- Totale ordine letto da OCR/PDF (conferme senza righe Rekki).

ALTER TABLE public.conferme_ordine
  ADD COLUMN IF NOT EXISTS importo_totale numeric(14, 2);

COMMENT ON COLUMN public.conferme_ordine.importo_totale IS
  'Importo totale documento (OCR/PDF), usato quando righe prodotto non sono disponibili.';
