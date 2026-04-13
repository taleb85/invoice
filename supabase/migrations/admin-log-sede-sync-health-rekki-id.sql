-- Log email: sede + nome allegato (debug / salute sync)
ALTER TABLE public.log_sincronizzazione
  ADD COLUMN IF NOT EXISTS sede_id uuid REFERENCES public.sedi(id) ON DELETE SET NULL;

ALTER TABLE public.log_sincronizzazione
  ADD COLUMN IF NOT EXISTS allegato_nome text;

CREATE INDEX IF NOT EXISTS idx_log_sinc_sede_data
  ON public.log_sincronizzazione (sede_id, data DESC)
  WHERE sede_id IS NOT NULL;

COMMENT ON COLUMN public.log_sincronizzazione.sede_id IS 'Sede IMAP di provenienza (se nota).';
COMMENT ON COLUMN public.log_sincronizzazione.allegato_nome IS 'Nome file allegato elaborato.';

-- Sede: ultimo esito connessione IMAP (alert dashboard admin)
ALTER TABLE public.sedi
  ADD COLUMN IF NOT EXISTS last_imap_sync_at timestamptz;

ALTER TABLE public.sedi
  ADD COLUMN IF NOT EXISTS last_imap_sync_error text;

COMMENT ON COLUMN public.sedi.last_imap_sync_at IS 'Ultimo tentativo di scan IMAP completato senza eccezione di connessione.';
COMMENT ON COLUMN public.sedi.last_imap_sync_error IS 'Ultimo errore IMAP (auth, rete, ecc.); NULL se ultimo scan OK.';

-- Fornitore: ID fornitore su Rekki (mapping piattaforma)
ALTER TABLE public.fornitori
  ADD COLUMN IF NOT EXISTS rekki_supplier_id text;

COMMENT ON COLUMN public.fornitori.rekki_supplier_id IS 'Identificativo fornitore su Rekki per mapping e confronto listini.';
