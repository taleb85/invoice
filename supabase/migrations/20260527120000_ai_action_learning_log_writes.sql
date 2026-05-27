-- Registra ogni upsert anche in ai_action_learning_log + backfill storico.

create or replace function public.upsert_action_learning(
    p_sede_id           uuid,
    p_fornitore_id      uuid,
    p_contesto          jsonb,
    p_azione_id         text,
    p_era_suggerimento  boolean default false,
    p_seguito_consiglio boolean default true
) returns uuid as $$
declare
    v_id uuid;
    v_conferme integer;
    v_esito text;
begin
    v_esito := case
        when p_seguito_consiglio then 'successo'
        else 'annullato'
    end;

    select id, totali_conferme into v_id, v_conferme
    from public.ai_action_learning
    where (sede_id is not distinct from p_sede_id)
      and (fornitore_id is not distinct from p_fornitore_id)
      and azione_id = p_azione_id
      and contesto = p_contesto;

    if found then
        update public.ai_action_learning
        set
            totali_conferme = case
                when p_seguito_consiglio then totali_conferme + 1
                else totali_conferme
            end,
            totali_suggerimenti = case
                when p_era_suggerimento then totali_suggerimenti + 1
                else totali_suggerimenti
            end,
            ultima_conferma_at = case
                when p_seguito_consiglio then now()
                else ultima_conferma_at
            end,
            ultima_esecuzione_at = now(),
            updated_at = now()
        where id = v_id;
    else
        insert into public.ai_action_learning (
            sede_id, fornitore_id, contesto, azione_id,
            totali_conferme, totali_suggerimenti,
            ultima_conferma_at, ultima_esecuzione_at
        ) values (
            p_sede_id, p_fornitore_id, p_contesto, p_azione_id,
            case when p_seguito_consiglio then 1 else 0 end,
            case when p_era_suggerimento then 1 else 0 end,
            case when p_seguito_consiglio then now() else null end,
            now()
        )
        returning id into v_id;
    end if;

    insert into public.ai_action_learning_log (
        learning_id,
        sede_id,
        fornitore_id,
        contesto,
        azione_eseguita,
        era_suggerimento,
        esito
    ) values (
        v_id,
        p_sede_id,
        p_fornitore_id,
        p_contesto,
        p_azione_id,
        coalesce(p_era_suggerimento, false),
        v_esito
    );

    return v_id;
end;
$$ language plpgsql security definer;

-- Backfill: una riga di log per ogni pattern già appreso (ultima esecuzione nota).
insert into public.ai_action_learning_log (
    learning_id,
    sede_id,
    fornitore_id,
    contesto,
    azione_eseguita,
    era_suggerimento,
    esito,
    created_at
)
select
    a.id,
    a.sede_id,
    a.fornitore_id,
    a.contesto,
    a.azione_id,
    false,
    'successo',
    coalesce(a.ultima_esecuzione_at, a.updated_at, a.created_at)
from public.ai_action_learning a
where coalesce(a.ultima_esecuzione_at, a.updated_at, a.created_at) is not null
  and not exists (
    select 1
    from public.ai_action_learning_log l
    where l.learning_id = a.id
  );

SELECT pg_notify('pgrst', 'reload schema');
