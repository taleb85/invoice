-- Profili di parsing per fornitore.
-- Ogni fornitore può avere un layout registrato con pattern di estrazione righe.
-- I nuovi fornitori vengono auto-rilevati al primo parsing riuscito.
CREATE TABLE IF NOT EXISTS public.fornitori_layout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornitore_id uuid NOT NULL REFERENCES public.fornitori(id) ON DELETE CASCADE UNIQUE,
  nome_layout text NOT NULL,                  -- es. 'hallgarten_vino', 'carnevale', 'mondial_wine'
  -- Come riconoscere questo fornitore dal testo del PDF:
  firma_testuale text NOT NULL,               -- regex o keyword univoca nel PDF (es. 'Hallgarten Wines')
  colonne jsonb NOT NULL DEFAULT '[]',        -- [{nome:'codice', pos:1}, {nome:'descrizione', pos:2}, ...]
  -- Pattern regex per estrarre le righe prodotto:
  pattern_riga text NOT NULL,                 -- regex con gruppi nominati (es. (?<codice>...) )
  -- Mappa dei gruppi regex → campi del LineItem:
  mappa_campi jsonb NOT NULL DEFAULT '{}',    -- {codice:'codice_prodotto', desc:'prodotto', unit:'prezzo', ...}
  -- Flag per il parsing:
  testo_multiriga boolean DEFAULT false,      -- true se una riga prodotto può andare su più linee PDF
  separatore_migliaia text,                   -- es. ',' per 1,234.56
  separatore_decimali text DEFAULT '.',       -- es. '.' per 1.234,56
  valuta text DEFAULT 'GBP',
  -- Statistiche:
  volte_usato integer DEFAULT 0,
  ultimo_uso timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_fornitori_layout_fornitore ON public.fornitori_layout(fornitore_id);
CREATE INDEX IF NOT EXISTS idx_fornitori_layout_nome ON public.fornitori_layout(nome_layout);

-- Funzione per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_fornitori_layout_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fornitori_layout_updated_at ON public.fornitori_layout;
CREATE TRIGGER trg_fornitori_layout_updated_at
  BEFORE UPDATE ON public.fornitori_layout
  FOR EACH ROW EXECUTE FUNCTION update_fornitori_layout_updated_at();

-- RLS: solo il service role può leggere/scrivere (leggibile anche da authenticated per debug)
ALTER TABLE public.fornitori_layout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.fornitori_layout
  FOR ALL
  USING (true)
  WITH CHECK (true);
