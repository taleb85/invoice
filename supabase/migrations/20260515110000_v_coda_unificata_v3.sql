-- =============================================================
-- Vista Coda Unificata v3 — Hub di controllo centralizzato
-- Unifica TUTTE le eccezioni che richiedono attenzione:
--   1. Documenti da processare (email/scan)
--   2. Righe estratto conto con anomalie
--   3. Fatture in attesa di approvazione
--   4. Errori sincronizzazione email
--   5. Bolle aperte (senza fattura collegata)
-- Ogni riga ha tutti i campi necessari per la UI + AI learning.
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
        extract(day from now() - d.created_at)::int as giorni_in_stato,
        -- Priorità: da_revisionare > bloccati > da_processare > da_associare
        case
            when d.stato = 'da_revisionare' then 1
            when d.stato in ('da_processare', 'da_associare') and d.created_at < now() - interval '7 days' then 2
            when d.stato = 'da_processare' then 3
            when d.stato = 'da_associare' then 4
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
        null::int as giorni_in_stato,
        -- Priorità errore importo > fattura mancante > bolle mancanti
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
        null::int as giorni_in_stato,
        5 as priorita  -- priorità fissa medio-bassa
    from public.fatture f
    left join public.fornitori fn3 on fn3.id = f.fornitore_id
    where f.approval_status = 'pending'
),

-- 4. Errori sincronizzazione email (ultime 72h)
errori_sincro as (
    select
        l.id,
        'errore_sincronizzazione'::text as origine,
        l.stato as stato_origine,
        'errore_sincro'::text as pending_kind,
        l.fornitore_id,
        fn4.nome as fornitore_nome,
        null::uuid as sede_id,
        l.mittente as riferimenti,
        null::text as nome_file,
        null::date as data_doc,
        l.data as data_inserimento,
        l.file_url,
        jsonb_build_object(
            'stato', l.stato,
            'errore_dettaglio', l.errore_dettaglio,
            'oggetto_mail', l.oggetto_mail
        ) as contesto_originale,
        -- Campi arricchiti
        l.mittente,
        l.oggetto_mail,
        null::numeric as importo,
        null::text as numero_documento,
        null::text as ocr_tipo,
        null::text as ocr_ragione_sociale,
        null::text as ocr_p_iva,
        null::text as matched_by,
        null::int as giorni_in_stato,
        6 as priorita
    from public.log_sincronizzazione l
    left join public.fornitori fn4 on fn4.id = l.fornitore_id
    where l.stato in ('fornitore_non_trovato', 'bolla_non_trovata')
      and l.data > now() - interval '72 hours'
),

-- 5. Bolle aperte senza fattura (stato bozza/in attesa, nessuna fattura collegata)
bolle_aperte as (
    select
        b.id,
        'bolla_aperta'::text as origine,
        b.stato as stato_origine,
        'bolla'::text as pending_kind,
        b.fornitore_id,
        fn5.nome as fornitore_nome,
        b.sede_id,
        b.numero_bolla as riferimenti,
        null::text as nome_file,
        b.data as data_doc,
        b.created_at as data_inserimento,
        b.file_url,
        jsonb_build_object(
            'importo', b.importo,
            'stato', b.stato,
            'numero_bolla', b.numero_bolla,
            'prezzo_rekki', b.prezzo_rekki
        ) as contesto_originale,
        -- Campi arricchiti
        null::text as mittente,
        null::text as oggetto_mail,
        b.importo,
        b.numero_bolla as numero_documento,
        null::text as ocr_tipo,
        null::text as ocr_ragione_sociale,
        null::text as ocr_p_iva,
        null::text as matched_by,
        extract(day from now() - b.created_at)::int as giorni_in_stato,
        case
            when b.created_at < now() - interval '14 days' then 3
            when b.created_at < now() - interval '7 days' then 4
            else 7
        end as priorita
    from public.bolle b
    left join public.fornitori fn5 on fn5.id = b.fornitore_id
    where b.stato in ('bozza', 'in attesa')
      and not exists (
          select 1 from public.fatture f where f.bolla_id = b.id
      )
)

select * from doc_processare
union all
select * from righe_statement
union all
select * from fatture_pending
union all
select * from errori_sincro
union all
select * from bolle_aperte;

comment on view public.v_coda_unificata is
    'Coda unificata v3 — hub controllo centralizzato: documenti, statements, fatture, errori sincro, bolle aperte.';

grant select on public.v_coda_unificata to authenticated, service_role;
