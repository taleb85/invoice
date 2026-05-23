-- Migration: statements.linked_fattura_id
-- Quando un PDF contiene SIA un estratto conto SIA una fattura, l'utente può
-- registrare una fattura separata mantenendo l'estratto conto attivo per la
-- riconciliazione. La colonna sotto evita che la pulizia automatica
-- (autoConvertInvoiceStatements) elimini lo statement quando trova una
-- fattura con lo stesso file_url.

ALTER TABLE public.statements
  ADD COLUMN IF NOT EXISTS linked_fattura_id uuid REFERENCES public.fatture(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS statements_linked_fattura_id_idx
  ON public.statements(linked_fattura_id)
  WHERE linked_fattura_id IS NOT NULL;

SELECT pg_notify('pgrst', 'reload schema');
