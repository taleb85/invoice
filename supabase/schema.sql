-- =============================================================
-- Gestionale Acquisti – Schema Supabase
-- Esegui questo script nell'SQL Editor del tuo progetto Supabase
-- =============================================================

create extension if not exists "pgcrypto";

-- Funzione aggiornamento automatico updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================
-- 1. FORNITORI
-- =============================================================
create table if not exists public.fornitori (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  nome       text not null,
  email      text,
  piva       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fornitori_user_id_idx on public.fornitori(user_id);

create trigger fornitori_updated_at
  before update on public.fornitori
  for each row execute procedure public.set_updated_at();

alter table public.fornitori enable row level security;

create policy "Utente vede i propri fornitori"
  on public.fornitori for select using (auth.uid() = user_id);
create policy "Utente crea i propri fornitori"
  on public.fornitori for insert with check (auth.uid() = user_id);
create policy "Utente aggiorna i propri fornitori"
  on public.fornitori for update using (auth.uid() = user_id);
create policy "Utente elimina i propri fornitori"
  on public.fornitori for delete using (auth.uid() = user_id);

-- =============================================================
-- 2. BOLLE
-- =============================================================
create table if not exists public.bolle (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  fornitore_id uuid not null references public.fornitori(id) on delete restrict,
  data         date not null,
  file_url     text,
  stato        text not null default 'in attesa'
                 check (stato in ('in attesa', 'completato')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists bolle_user_id_idx      on public.bolle(user_id);
create index if not exists bolle_fornitore_id_idx on public.bolle(fornitore_id);
create index if not exists bolle_stato_idx        on public.bolle(stato);

create trigger bolle_updated_at
  before update on public.bolle
  for each row execute procedure public.set_updated_at();

alter table public.bolle enable row level security;

create policy "Utente vede le proprie bolle"
  on public.bolle for select using (auth.uid() = user_id);
create policy "Utente crea le proprie bolle"
  on public.bolle for insert with check (auth.uid() = user_id);
create policy "Utente aggiorna le proprie bolle"
  on public.bolle for update using (auth.uid() = user_id);
create policy "Utente elimina le proprie bolle"
  on public.bolle for delete using (auth.uid() = user_id);

-- =============================================================
-- 3. FATTURE
-- =============================================================
create table if not exists public.fatture (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  fornitore_id uuid not null references public.fornitori(id) on delete restrict,
  bolla_id     uuid references public.bolle(id) on delete set null,
  data         date not null,
  file_url     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists fatture_user_id_idx      on public.fatture(user_id);
create index if not exists fatture_fornitore_id_idx on public.fatture(fornitore_id);
create index if not exists fatture_bolla_id_idx     on public.fatture(bolla_id);

create trigger fatture_updated_at
  before update on public.fatture
  for each row execute procedure public.set_updated_at();

alter table public.fatture enable row level security;

create policy "Utente vede le proprie fatture"
  on public.fatture for select using (auth.uid() = user_id);
create policy "Utente crea le proprie fatture"
  on public.fatture for insert with check (auth.uid() = user_id);
create policy "Utente aggiorna le proprie fatture"
  on public.fatture for update using (auth.uid() = user_id);
create policy "Utente elimina le proprie fatture"
  on public.fatture for delete using (auth.uid() = user_id);

-- =============================================================
-- 4. STORAGE – bucket per allegati
-- =============================================================
-- Esegui nel pannello Storage → New bucket oppure via SQL:
insert into storage.buckets (id, name, public)
values ('allegati', 'allegati', false)
on conflict do nothing;

create policy "Utente legge i propri allegati"
  on storage.objects for select
  using (auth.uid()::text = (storage.foldername(name))[1]);

create policy "Utente carica i propri allegati"
  on storage.objects for insert
  with check (auth.uid()::text = (storage.foldername(name))[1]);

create policy "Utente elimina i propri allegati"
  on storage.objects for delete
  using (auth.uid()::text = (storage.foldername(name))[1]);
