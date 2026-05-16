-- =============================================================
-- Sincronizza azioni manuali (documenti_verifica_action_log)
-- nel sistema di apprendimento AI (ai_action_learning)
--
-- Ogni azione manuale dell'operatore (Scarta, Resetta, ...)
-- viene automaticamente registrata come conferma nell'AI
-- action learning, così l'AI impara dai pattern reali.
-- =============================================================

-- 1. Funzione di mapping action → CommandId
create or replace function public.map_verifica_action_to_azione_id(p_action text)
returns text as $$
begin
    return case p_action
        when 'scarta'              then 'documento.scarta'
        when 'resetta'             then 'documento.rianalizza_ocr'
        when 'elimina_duplicato'   then 'documento.scarta'
        when 'aggiorna_categoria'  then 'documento.aggiorna_categoria'
        else 'documento.' || p_action
    end;
end;
$$ language plpgsql immutable;

comment on function public.map_verifica_action_to_azione_id is
    'Mappa le azioni della pagina Verifica Associazioni ai CommandId del sistema di apprendimento AI.';

-- 2. Funzione trigger
create or replace function public.sync_verifica_action_to_ai_learning()
returns trigger as $$
declare
    v_azione_id text;
    v_contesto  jsonb;
    v_categoria text;
begin
    v_azione_id := map_verifica_action_to_azione_id(new.action);

    v_categoria := coalesce(new.documento_categoria, 'sconosciuta');

    v_contesto := jsonb_build_object(
        'fonte',               'verifica_associazioni',
        'action_originale',    new.action,
        'anomalie_tipi',       to_jsonb(new.anomalie_tipi),
        'anomalie_gravita',    new.anomalie_gravita,
        'anomalie_count',      new.anomalie_count,
        'documento_categoria', v_categoria,
        'file_name',           new.file_name,
        'consigliato',         new.consigliato,
        'seguito_consiglio',   new.seguito_consiglio
    );

    perform public.upsert_action_learning(
        p_sede_id           => new.sede_id,
        p_fornitore_id      => new.fornitore_id,
        p_contesto          => v_contesto,
        p_azione_id         => v_azione_id,
        p_era_suggerimento  => new.consigliato is not null,
        p_seguito_consiglio => true
    );

    return new;
end;
$$ language plpgsql security definer;

comment on function public.sync_verifica_action_to_ai_learning is
    'Trigger function: quando un operatore esegue un''azione in Verifica Associazioni, la registra anche in ai_action_learning per l''apprendimento AI.';

-- 3. Trigger su INSERT
drop trigger if exists trg_sync_verifica_action_to_ai_learning on public.documenti_verifica_action_log;
create trigger trg_sync_verifica_action_to_ai_learning
    after insert on public.documenti_verifica_action_log
    for each row
    execute function public.sync_verifica_action_to_ai_learning();

-- 4. Backfill: sincronizza tutte le azioni passate
do $$
declare
    r           record;
    v_azione_id text;
    v_contesto  jsonb;
    v_categoria text;
    v_count     int := 0;
begin
    for r in
        select * from public.documenti_verifica_action_log
        where not exists (
            select 1 from public.ai_action_learning
            where contesto->>'action_originale' = documenti_verifica_action_log.action
              and contesto->>'fonte' = 'verifica_associazioni'
              and sede_id is not distinct from documenti_verifica_action_log.sede_id
            limit 1
        )
    loop
        v_azione_id := map_verifica_action_to_azione_id(r.action);
        v_categoria := coalesce(r.documento_categoria, 'sconosciuta');

        v_contesto := jsonb_build_object(
            'fonte',               'verifica_associazioni',
            'action_originale',    r.action,
            'anomalie_tipi',       to_jsonb(r.anomalie_tipi),
            'anomalie_gravita',    r.anomalie_gravita,
            'anomalie_count',      r.anomalie_count,
            'documento_categoria', v_categoria,
            'file_name',           r.file_name,
            'consigliato',         r.consigliato,
            'seguito_consiglio',   r.seguito_consiglio
        );

        perform public.upsert_action_learning(
            p_sede_id           => r.sede_id,
            p_fornitore_id      => r.fornitore_id,
            p_contesto          => v_contesto,
            p_azione_id         => v_azione_id,
            p_era_suggerimento  => r.consigliato is not null,
            p_seguito_consiglio => true
        );
        v_count := v_count + 1;
    end loop;

    raise notice '[AI-LEARNING] Backfill completato: % record sincronizzati da documenti_verifica_action_log a ai_action_learning.', v_count;
end;
$$;
