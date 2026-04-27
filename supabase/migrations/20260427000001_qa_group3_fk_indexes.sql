-- QA 2026-04-27 — Gruppo 3.1 — indici su foreign key (IF NOT EXISTS)

CREATE INDEX IF NOT EXISTS idx_bolle_sede_id ON public.bolle (sede_id);

CREATE INDEX IF NOT EXISTS idx_fatture_sede_id ON public.fatture (sede_id);
CREATE INDEX IF NOT EXISTS idx_fatture_fornitore_id ON public.fatture (fornitore_id);
CREATE INDEX IF NOT EXISTS idx_fatture_approved_by ON public.fatture (approved_by);

CREATE INDEX IF NOT EXISTS idx_fornitori_sede_id ON public.fornitori (sede_id);

CREATE INDEX IF NOT EXISTS idx_profiles_sede_id ON public.profiles (sede_id);

CREATE INDEX IF NOT EXISTS idx_documenti_sede_id ON public.documenti_da_processare (sede_id);
CREATE INDEX IF NOT EXISTS idx_documenti_bolla_id ON public.documenti_da_processare (bolla_id);
CREATE INDEX IF NOT EXISTS idx_documenti_fattura_id ON public.documenti_da_processare (fattura_id);

CREATE INDEX IF NOT EXISTS idx_srows_statement_id ON public.statement_rows (statement_id);
CREATE INDEX IF NOT EXISTS idx_srows_fattura_id ON public.statement_rows (fattura_id);
CREATE INDEX IF NOT EXISTS idx_srows_fornitore_id ON public.statement_rows (fornitore_id);

CREATE INDEX IF NOT EXISTS idx_statements_fornitore_id ON public.statements (fornitore_id);

CREATE INDEX IF NOT EXISTS idx_log_sinc_fornitore_id ON public.log_sincronizzazione (fornitore_id);

CREATE INDEX IF NOT EXISTS idx_conferme_sede_id ON public.conferme_ordine (sede_id);

-- 3.3 — indice duplicato (nome da report; ignora se assente)
DROP INDEX IF EXISTS public.log_sincronizzazione_data_idx;

SELECT pg_notify('pgrst', 'reload schema');
