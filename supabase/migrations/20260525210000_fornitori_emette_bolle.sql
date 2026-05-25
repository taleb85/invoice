-- Migration: Flag `emette_bolle` su fornitori
--
-- Alcuni fornitori (es. esteri o piccoli grossisti) non spediscono mai un DDT
-- separato dalla fattura: ogni fattura è già "accompagnatoria" e il flusso
-- merce ↔ fattura coincide. Il triple-check, che pretende sempre una bolla
-- collegata, in quei casi marca le righe statement come `bolle_mancanti` per
-- sempre, anche quando fattura e importo combaciano.
--
-- Aggiungiamo un flag opzionale sui fornitori, default `true` (=il fornitore
-- emette bolle, comportamento storico). Quando l'operatore lo mette a `false`,
-- il triple-check considera la riga `ok` se fattura+importo combaciano, anche
-- senza bolla collegata.

ALTER TABLE public.fornitori
  ADD COLUMN IF NOT EXISTS emette_bolle boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.fornitori.emette_bolle IS
  'Se false, il triple-check NON pretende una bolla per ogni fattura: '
  'utile per fornitori con fattura accompagnatoria o senza DDT separato.';
