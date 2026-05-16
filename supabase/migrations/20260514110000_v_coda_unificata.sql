-- =============================================================
-- Vista Coda Unificata (v2 — campi arricchiti per AI learning)
-- Unifica in una singola vista:
--   1. documenti_da_processare (documenti email da processare)
--   2. statement_rows (righe estratto conto con anomalie)
--   3. fatture (fatture in attesa di approvazione)
-- Ogni riga ha i campi chiave + contesto OCR/estrazione per AI.
-- =============================================================

drop view if exists public.v_coda_unificata;

create view public.v_coda_unificata as
with
-- 1. Documenti da processare (email/scan)
doc_processare as (
    select
        d.id,
        'documento_da_processare'::text as origine,
        d.stato as stato_origine,
        coalesce(d.metadata->>'pending_kind', 'da_determinare') as pending_kind,
        d.fornitore_id,
        fn1.nome as fornitore_nome,
        d.sede_id,
        d.mittente as riferimenti,
        d.file_name as nome_file,
        d.data_documento as data_doc,
        d.created_at as data_inserimento,
        d.file_url,
        d.metadata as contesto_originale,
        -- Campi arricchiti
        d.mittente,
        d.oggetto_mail,
        (d.metadata->>'totale_iva_inclusa')::numeric as importo,
        d.metadata->>'numero_fattura' as numero_documento,
        d.metadata->>'tipo_documento' as ocr_tipo,
        d.metadata->>'ragione_sociale' as ocr_ragione_sociale,
        d.metadata->>'p_iva' as ocr_p_iva,
        d.metadata->>'matched_by' as matched_by,
        -- Priorità: da_revisionare > da_processare > da_associare
        case d.stato
            when 'da_revisionare' then 1
            when 'da_processare'  then 2
            when 'da_associare'   then 3
            else 99
        end as priorita
    from public.documenti_da_processare d
    left join public.fornitori fn1 on fn1.id = d.fornitore_id
    where d.stato in ('da_processare', 'da_associare', 'da_revisionare')
),

-- 2. Righe estratto conto con anomalie
righe_statement as (
    select
        sr.id,
        'riga_statement'::text as origine,
        sr.check_status as stato_origine,
        'statement'::text as pending_kind,
        sr.fornitore_id,
        fn2.nome as fornitore_nome,
        s.sede_id,
        sr.numero_doc as riferimenti,
        null::text as nome_file,
        sr.data_doc,
        sr.created_at as data_inserimento,
        null::text as file_url,
        jsonb_build_object(
            'check_status', sr.check_status,
            'importo', sr.importo,
            'delta_importo', sr.delta_importo,
            'fattura_id', sr.fattura_id,
            'fattura_numero', sr.fattura_numero,
            'statement_id', sr.statement_id,
            'bolle_json', sr.bolle_json
        ) as contesto_originale,
        -- Campi arricchiti
        null::text as mittente,
        null::text as oggetto_mail,
        sr.importo,
        sr.numero_doc as numero_documento,
        null::text as ocr_tipo,
        null::text as ocr_ragione_sociale,
        null::text as ocr_p_iva,
        null::text as matched_by,
        -- Priorità errore importo > bolle mancanti > prezzo discordanza
        case sr.check_status
            when 'errore_importo'        then 1
            when 'fattura_mancante'      then 2
            when 'rekki_prezzo_discordanza' then 2
            when 'bolle_mancanti'        then 3
            else 99
        end as priorita
    from public.statement_rows sr
    join public.statements s on s.id = sr.statement_id
    left join public.fornitori fn2 on fn2.id = sr.fornitore_id
    where sr.check_status != 'ok'
),

-- 3. Fatture in attesa di approvazione
fatture_pending as (
    select
        f.id,
        'fattura'::text as origine,
        f.approval_status as stato_origine,
        case when f.is_credit_note then 'nota_credito' else 'fattura' end::text as pending_kind,
        f.fornitore_id,
        fn3.nome as fornitore_nome,
        f.sede_id,
        f.numero_fattura as riferimenti,
        null::text as nome_file,
        f.data as data_doc,
        f.data as data_inserimento,
        f.file_url,
        jsonb_build_object(
            'approval_status', f.approval_status,
            'importo', f.importo,
            'approval_threshold', f.approval_threshold,
            'is_credit_note', f.is_credit_note
        ) as contesto_originale,
        -- Campi arricchiti
        null::text as mittente,
        null::text as oggetto_mail,
        f.importo,
        f.numero_fattura as numero_documento,
        null::text as ocr_tipo,
        null::text as ocr_ragione_sociale,
        null::text as ocr_p_iva,
        null::text as matched_by,
        5 as priorita  -- priorità fissa medio-bassa
    from public.fatture f
    left join public.fornitori fn3 on fn3.id = f.fornitore_id
    where f.approval_status = 'pending'
)

select * from doc_processare
union all
select * from righe_statement
union all
select * from fatture_pending;

comment on view public.v_coda_unificata is
    'Coda unificata v2: documenti da processare, righe statement, fatture pending. Include mittente, importo, numero_doc, OCR fields per AI learning.';

-- Permessi: solo service_role e authenticated (via RLS applicata alle tabelle sottostanti)
grant select on public.v_coda_unificata to authenticated, service_role;
