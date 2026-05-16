-- =============================================================
-- AI Action Learning Engine
-- Unifica e sostituisce:
--   - documenti_verifica_action_log (pattern matching)
--   - fornitore_ocr_tipo_pending_kind_hints (tipo per fornitore)
-- Memorizza il contesto di ogni azione confermata dall'operatore
-- per permettere all'AI di suggerire azioni su documenti simili.
-- =============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- 1. Tabella principale di apprendimento
-- -------------------------------------------------------------
create table if not exists public.ai_action_learning (
    id              uuid primary key default gen_random_uuid(),
    sede_id         uuid references public.sedi(id) on delete cascade,
    fornitore_id    uuid references public.fornitori(id) on delete set null,

    -- Contesto strutturato dell'azione
    -- Es: { "tipo_documento": "fattura", "mittente": "no-reply@acme.com",
    --       "stato_corrente": "da_associare", "categoria": "fiscale" }
    contesto        jsonb not null default '{}',

    -- L'azione che l'AI ha imparato (CommandId)
    azione_id       text not null,

    -- Metadati di apprendimento
    totali_conferme     integer not null default 1,
    totali_suggerimenti integer not null default 1,
    ultima_conferma_at  timestamptz,
    ultima_esecuzione_at timestamptz default now(),
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now(),

    -- Unicità per contesto + azione + sede (fornitore opzionale)
    unique (sede_id, fornitore_id, azione_id, contesto)
);

-- Indici per ricerca rapida
create index if not exists idx_ai_action_learning_sede
    on public.ai_action_learning (sede_id);
create index if not exists idx_ai_action_learning_fornitore
    on public.ai_action_learning (fornitore_id);
create index if not exists idx_ai_action_learning_azione
    on public.ai_action_learning (azione_id);
create index if not exists idx_ai_action_learning_conferme
    on public.ai_action_learning (totali_conferme desc);
create index if not exists idx_ai_action_learning_contesto
    on public.ai_action_learning using gin (contesto);

comment on table public.ai_action_learning is
    'Apprendimento AI: memorizza il contesto di ogni azione confermata per suggerire azioni future.';

-- -------------------------------------------------------------
-- 2. Tabella log delle azioni AI (audit trail)
-- -------------------------------------------------------------
create table if not exists public.ai_action_learning_log (
    id              uuid primary key default gen_random_uuid(),
    created_at      timestamptz not null default now(),

    learning_id     uuid references public.ai_action_learning(id) on delete set null,
    sede_id         uuid references public.sedi(id) on delete cascade,
    fornitore_id    uuid references public.fornitori(id) on delete set null,
    documento_id    uuid,
    documento_origine text,

    contesto        jsonb not null default '{}',
    azione_eseguita text not null,
    era_suggerimento  boolean not null default false,
    eseguito_da     uuid,
    auto_eseguito   boolean not null default false,
    esito           text not null default 'successo'
        check (esito in ('successo', 'fallito', 'annullato')),
    errore          text
);

create index if not exists idx_ai_action_learning_log_created
    on public.ai_action_learning_log (created_at desc);
create index if not exists idx_ai_action_learning_log_sede
    on public.ai_action_learning_log (sede_id);
create index if not exists idx_ai_action_learning_log_azione
    on public.ai_action_learning_log (azione_eseguita);

comment on table public.ai_action_learning_log is
    'Audit trail delle azioni AI: ogni esecuzione (auto o manuale) è tracciata.';

-- -------------------------------------------------------------
-- 3. Funzione di upsert per l'apprendimento
-- -------------------------------------------------------------
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
begin
    -- Cerca record esistente
    select id, totali_conferme into v_id, v_conferme
    from public.ai_action_learning
    where (sede_id is not distinct from p_sede_id)
      and (fornitore_id is not distinct from p_fornitore_id)
      and azione_id = p_azione_id
      and contesto = p_contesto;

    if found then
        -- Aggiorna record esistente
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
        return v_id;
    else
        -- Crea nuovo record
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
        return v_id;
    end if;
end;
$$ language plpgsql security definer;

-- -------------------------------------------------------------
-- 4. Funzione per calcolare confidenza suggerimento
-- -------------------------------------------------------------
create or replace function public.calcola_confidenza_suggerimento(
    p_sede_id       uuid,
    p_fornitore_id  uuid,
    p_contesto      jsonb
) returns table (
    azione_id       text,
    confidenza      integer,
    totali_conferme integer,
    totali_suggeriti integer,
    match_tipo      text  -- 'esatto', 'generico'
) as $$
begin
    -- 1. Cerca match esatto (stesso fornitore + contesto)
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
      and a.contesto @> p_contesto
      and a.totali_conferme >= 3
    order by a.totali_conferme desc
    limit 1;

    if not found then
        -- 2. Match generico (stesso tipo, fornitore nullo)
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
          and a.contesto @> (p_contesto - 'mittente' - 'fornitore_id')
          and a.totali_conferme >= 3
        order by a.totali_conferme desc
        limit 1;
    end if;
end;
$$ language plpgsql security definer;

-- -------------------------------------------------------------
-- 5. RLS policies
-- -------------------------------------------------------------
alter table public.ai_action_learning enable row level security;
alter table public.ai_action_learning_log enable row level security;

-- Accesso tramite service role per le API
create policy "ai_action_learning_service_role"
    on public.ai_action_learning
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

create policy "ai_action_learning_log_service_role"
    on public.ai_action_learning_log
    for all
    using (auth.role() = 'service_role')
    with check (auth.role() = 'service_role');

-- Accesso per admin a tutte le sedi
create policy "ai_action_learning_admin_all"
    on public.ai_action_learning
    for select
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid()
            and role = 'admin'
        )
    );

create policy "ai_action_learning_log_admin_all"
    on public.ai_action_learning_log
    for select
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid()
            and role = 'admin'
        )
    );

-- Accesso per operatori alla propria sede
create policy "ai_action_learning_operator_sede"
    on public.ai_action_learning
    for select
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid()
            and (role = 'admin_sede' or role = 'operatore')
            and sede_id = ai_action_learning.sede_id
        )
    );

create policy "ai_action_learning_log_operator_sede"
    on public.ai_action_learning_log
    for select
    using (
        exists (
            select 1 from public.profiles
            where id = auth.uid()
            and (role = 'admin_sede' or role = 'operatore')
            and sede_id = ai_action_learning_log.sede_id
        )
    );
