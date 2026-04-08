-- =============================================================
-- Log Sincronizzazione Email
-- Esegui questo script nell'SQL Editor del tuo progetto Supabase
-- =============================================================

create table if not exists public.log_sincronizzazione (
  id               uuid primary key default gen_random_uuid(),
  data             timestamptz not null default now(),
  mittente         text not null,
  oggetto_mail     text,
  stato            text not null
                     check (stato in ('successo', 'fornitore_non_trovato', 'bolla_non_trovata')),
  errore_dettaglio text,
  -- campi aggiuntivi per funzione "Riprova"
  fornitore_id     uuid references public.fornitori(id) on delete set null,
  file_url         text
);

create index if not exists log_sincronizzazione_data_idx   on public.log_sincronizzazione(data desc);
create index if not exists log_sincronizzazione_stato_idx  on public.log_sincronizzazione(stato);

-- RLS: solo utenti autenticati
alter table public.log_sincronizzazione enable row level security;

create policy "Authenticated: select log"
  on public.log_sincronizzazione for select to authenticated using (true);

create policy "Authenticated: insert log"
  on public.log_sincronizzazione for insert to authenticated with check (true);

create policy "Authenticated: update log"
  on public.log_sincronizzazione for update to authenticated using (true);
