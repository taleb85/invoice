-- Aggrega pattern di apprendimento: contesto normalizzato (senza file/anomalie/email intera)
-- così le conferme si sommano su scenari ripetuti.

create or replace function public.normalize_action_learning_contesto(p_contesto jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_fonte text;
  v_mittente text;
  v_domain text;
begin
  if p_contesto is null or p_contesto = '{}'::jsonb then
    return '{}'::jsonb;
  end if;

  v_fonte := nullif(trim(p_contesto->>'fonte'), '');

  if v_fonte = 'verifica_associazioni' then
    return jsonb_strip_nulls(jsonb_build_object(
      'fonte', 'verifica_associazioni',
      'action_originale', nullif(trim(p_contesto->>'action_originale'), ''),
      'documento_categoria', coalesce(nullif(trim(p_contesto->>'documento_categoria'), ''), 'sconosciuta')
    ));
  end if;

  v_mittente := coalesce(
    nullif(trim(p_contesto->>'mittente'), ''),
    nullif(trim(p_contesto->>'mittente_domain'), '')
  );

  if v_mittente is not null and position('@' in v_mittente) > 0 then
    v_domain := lower(split_part(v_mittente, '@', 2));
  elsif v_mittente is not null then
    v_domain := lower(v_mittente);
  else
    v_domain := null;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'origine', nullif(trim(p_contesto->>'origine'), ''),
    'stato_origine', nullif(trim(p_contesto->>'stato_origine'), ''),
    'pending_kind', nullif(trim(p_contesto->>'pending_kind'), ''),
    'mittente_domain', v_domain
  ));
end;
$$;

comment on function public.normalize_action_learning_contesto(jsonb) is
  'Riduce il contesto apprendimento AI a chiavi stabili (tipo doc, categoria, dominio mittente) per aggregare conferme.';

-- Trigger Verifica: contesto già minimale (normalizzazione in upsert come rete di sicurezza).
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
    'documento_categoria', v_categoria
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
    v_contesto jsonb;
begin
    v_contesto := public.normalize_action_learning_contesto(p_contesto);

    v_esito := case
        when p_seguito_consiglio then 'successo'
        else 'annullato'
    end;

    select id, totali_conferme into v_id, v_conferme
    from public.ai_action_learning
    where (sede_id is not distinct from p_sede_id)
      and (fornitore_id is not distinct from p_fornitore_id)
      and azione_id = p_azione_id
      and contesto = v_contesto;

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
            p_sede_id, p_fornitore_id, v_contesto, p_azione_id,
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
        v_contesto,
        p_azione_id,
        coalesce(p_era_suggerimento, false),
        v_esito
    );

    return v_id;
end;
$$ language plpgsql security definer;

create or replace function public.calcola_confidenza_suggerimento(
    p_sede_id       uuid,
    p_fornitore_id  uuid,
    p_contesto      jsonb
) returns table (
    azione_id       text,
    confidenza      integer,
    totali_conferme integer,
    totali_suggeriti integer,
    match_tipo      text
) as $$
declare
    v_contesto jsonb;
begin
    v_contesto := public.normalize_action_learning_contesto(p_contesto);

    return query
    select
        a.azione_id,
        least(95, round((a.totali_conferme::numeric / nullif(a.totali_suggerimenti, 0)) * 100)::integer) as confidenza,
        a.totali_conferme,
        a.totali_suggerimenti,
        'esatto'::text as match_tipo
    from public.ai_action_learning a
    where a.sede_id = p_sede_id
      and a.fornitore_id = p_fornitore_id
      and a.contesto @> v_contesto
      and a.totali_conferme >= 3
    order by a.totali_conferme desc
    limit 1;

    if not found then
        return query
        select
            a.azione_id,
            least(85, round((a.totali_conferme::numeric / nullif(a.totali_suggerimenti, 0)) * 100)::integer) as confidenza,
            a.totali_conferme,
            a.totali_suggerimenti,
            'generico'::text as match_tipo
        from public.ai_action_learning a
        where a.sede_id = p_sede_id
          and a.fornitore_id is null
          and a.contesto @> (v_contesto - 'mittente_domain')
          and a.totali_conferme >= 3
        order by a.totali_conferme desc
        limit 1;
    end if;
end;
$$ language plpgsql security definer;

-- Unifica pattern storici frammentati (stesso contesto normalizzato).
do $$
declare
  g record;
  v_keep uuid;
  v_tail uuid[];
begin
  for g in
    select
      sede_id,
      fornitore_id,
      azione_id,
      public.normalize_action_learning_contesto(contesto) as norm_contesto,
      array_agg(id order by totali_conferme desc, updated_at desc) as ids,
      sum(totali_conferme)::integer as sum_conferme,
      sum(totali_suggerimenti)::integer as sum_suggerimenti,
      max(ultima_conferma_at) as max_conferma,
      max(ultima_esecuzione_at) as max_esecuzione
    from public.ai_action_learning
    group by sede_id, fornitore_id, azione_id, public.normalize_action_learning_contesto(contesto)
    having count(*) > 1
  loop
    v_keep := g.ids[1];
    if array_length(g.ids, 1) > 1 then
      v_tail := g.ids[2:array_length(g.ids, 1)];
    else
      v_tail := array[]::uuid[];
    end if;

    update public.ai_action_learning
    set
      contesto = g.norm_contesto,
      totali_conferme = g.sum_conferme,
      totali_suggerimenti = g.sum_suggerimenti,
      ultima_conferma_at = g.max_conferma,
      ultima_esecuzione_at = g.max_esecuzione,
      updated_at = now()
    where id = v_keep;

    if coalesce(array_length(v_tail, 1), 0) > 0 then
      update public.ai_action_learning_log
      set learning_id = v_keep
      where learning_id = any(v_tail);

      delete from public.ai_action_learning
      where id = any(v_tail);
    end if;
  end loop;

  update public.ai_action_learning
  set contesto = public.normalize_action_learning_contesto(contesto),
      updated_at = now()
  where contesto is distinct from public.normalize_action_learning_contesto(contesto);
end;
$$;

alter function public.normalize_action_learning_contesto(jsonb) set search_path = public;

select pg_notify('pgrst', 'reload schema');
