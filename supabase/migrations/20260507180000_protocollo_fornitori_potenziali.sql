-- Protocollo fornitori potenziali: tabelle per comunicazioni e cataloghi da fornitori non accreditati.
-- Safe to re-run: usa IF NOT EXISTS ovunque.

CREATE TABLE IF NOT EXISTS public.comunicazioni_fornitori_potenziali (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dati ricezione
  data_ricezione        timestamptz NOT NULL DEFAULT now(),
  canale                text NOT NULL DEFAULT 'email' CHECK (canale IN ('email', 'portale', 'riferimento_interno', 'altro')),
  email_ricevente       text,
  oggetto_email         text,
  corpo_email           text,
  email_allegato_url    text,

  -- Dati fornitore
  nome_azienda          text NOT NULL,
  nome_contatto         text,
  email_contatto        text,
  telefono_contatto     text,
  sito_web              text,
  partita_iva           text,
  sede_legale           text,
  paese                 text DEFAULT 'IT',

  -- Tipologia
  settore_merceologico  text,
  tipologia_prodotto    text[] DEFAULT '{}',
  fascia_prezzo         text CHECK (fascia_prezzo IN ('economica', 'media', 'alta', 'premium', 'non_specificata')),

  -- Scoring automatico
  score_qualita         integer CHECK (score_qualita BETWEEN 1 AND 5),
  score_prezzi          integer CHECK (score_prezzi BETWEEN 1 AND 5),
  score_certificazioni  integer CHECK (score_certificazioni BETWEEN 1 AND 5),
  score_referenze       integer CHECK (score_referenze BETWEEN 1 AND 5),
  score_documentazione  integer CHECK (score_documentazione BETWEEN 1 AND 5),
  score_affidabilita    integer CHECK (score_affidabilita BETWEEN 1 AND 5),
  score_totale          numeric(5,2),

  -- Workflow
  stato                 text NOT NULL DEFAULT 'da_valutare' CHECK (stato IN (
    'da_valutare', 'in_valutazione', 'approfondimento', 'approvato', 'rifiutato', 'archiviato'
  )),
  data_assegnazione     timestamptz,
  assegnato_a           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  esito                 text CHECK (esito IN ('approvato', 'rifiutato', 'archiviato', 'in_attesa')),
  data_esito            timestamptz,
  nota_esito            text,
  fornitore_creato_id   uuid REFERENCES public.fornitori(id) ON DELETE SET NULL,

  -- Dati valutazione
  data_scadenza_risposta timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cataloghi_fornitori_potenziali (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicazione_id      uuid NOT NULL REFERENCES public.comunicazioni_fornitori_potenziali(id) ON DELETE CASCADE,

  file_url              text NOT NULL,
  tipo_documento        text NOT NULL CHECK (tipo_documento IN (
    'listino_prezzi', 'catalogo_prodotti', 'scheda_tecnica', 'certificazione',
    'presentazione_aziendale', 'condizioni_vendita', 'altro'
  )),
  nome_file             text,
  dimensione_bytes      bigint,

  settore_merceologico  text,
  prodotti_rappresentati text[] DEFAULT '{}',
  valuta                text DEFAULT 'EUR',
  condizioni_pagamento  text,
  validita_da           date,
  validita_a            date,
  sconto_quantitativo   numeric(5,2),

  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comunicazioni_fornitori_stato
  ON public.comunicazioni_fornitori_potenziali(stato);
CREATE INDEX IF NOT EXISTS idx_comunicazioni_fornitori_data
  ON public.comunicazioni_fornitori_potenziali(data_ricezione);
CREATE INDEX IF NOT EXISTS idx_comunicazioni_fornitori_nome
  ON public.comunicazioni_fornitori_potenziali(nome_azienda);
CREATE INDEX IF NOT EXISTS idx_comunicazioni_fornitori_assegnato
  ON public.comunicazioni_fornitori_potenziali(assegnato_a) WHERE assegnato_a IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cataloghi_fornitori_comunicazione
  ON public.cataloghi_fornitori_potenziali(comunicazione_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.comunicazioni_fornitori_potenziali_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_comunicazioni_fornitori_potenziali_updated_at
  ON public.comunicazioni_fornitori_potenziali;
CREATE TRIGGER trg_comunicazioni_fornitori_potenziali_updated_at
  BEFORE UPDATE ON public.comunicazioni_fornitori_potenziali
  FOR EACH ROW EXECUTE FUNCTION public.comunicazioni_fornitori_potenziali_updated_at();

-- RLS: accesso solo autenticati
ALTER TABLE public.comunicazioni_fornitori_potenziali ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cataloghi_fornitori_potenziali ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'comunicazioni_fornitori_potenziali_select'
  ) THEN
    CREATE POLICY comunicazioni_fornitori_potenziali_select ON public.comunicazioni_fornitori_potenziali
      FOR SELECT USING (auth.role() = 'authenticated');
    CREATE POLICY comunicazioni_fornitori_potenziali_insert ON public.comunicazioni_fornitori_potenziali
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    CREATE POLICY comunicazioni_fornitori_potenziali_update ON public.comunicazioni_fornitori_potenziali
      FOR UPDATE USING (auth.role() = 'authenticated');
    CREATE POLICY comunicazioni_fornitori_potenziali_delete ON public.comunicazioni_fornitori_potenziali
      FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'cataloghi_fornitori_potenziali_select'
  ) THEN
    CREATE POLICY cataloghi_fornitori_potenziali_select ON public.cataloghi_fornitori_potenziali
      FOR SELECT USING (auth.role() = 'authenticated');
    CREATE POLICY cataloghi_fornitori_potenziali_insert ON public.cataloghi_fornitori_potenziali
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    CREATE POLICY cataloghi_fornitori_potenziali_update ON public.cataloghi_fornitori_potenziali
      FOR UPDATE USING (auth.role() = 'authenticated');
    CREATE POLICY cataloghi_fornitori_potenziali_delete ON public.cataloghi_fornitori_potenziali
      FOR DELETE USING (auth.role() = 'authenticated');
  END IF;
END $$;

COMMENT ON TABLE public.comunicazioni_fornitori_potenziali IS
  'Protocollo fornitori potenziali: comunicazioni da fornitori non accreditati con valutazione e workflow approvazione.';
COMMENT ON TABLE public.cataloghi_fornitori_potenziali IS
  'Cataloghi e documenti allegati alle comunicazioni di fornitori potenziali.';
