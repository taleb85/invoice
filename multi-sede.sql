-- ============================================================
-- multi-sede.sql — Eseguire nel SQL Editor di Supabase
-- ============================================================
-- ORDINE: tabelle → funzioni → policy → trigger → backfill
--
-- Dopo l'esecuzione, promuovi il tuo account ad admin:
--   UPDATE public.profiles SET role = 'admin'
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'tua-email@esempio.com');
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. Tabella sedi (senza policy per ora)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.sedi (
  id         uuid        primary key default gen_random_uuid(),
  nome       text        not null,
  created_at timestamptz not null default now()
);

alter table public.sedi enable row level security;


-- ──────────────────────────────────────────────────────────────
-- 2. Tabella profiles (deve esistere PRIMA delle funzioni helper)
-- ──────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  email      text,
  sede_id    uuid        references public.sedi(id) on delete set null,
  role       text        not null default 'operatore'
               check (role in ('admin', 'operatore')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;


-- ──────────────────────────────────────────────────────────────
-- 3. Helper functions (ora public.profiles esiste già)
-- ──────────────────────────────────────────────────────────────
create or replace function public.get_user_sede()
returns uuid
language sql stable security definer
as $$
  select sede_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
as $$
  select coalesce(
    (select role = 'admin' from public.profiles where id = auth.uid()),
    false
  );
$$;


-- ──────────────────────────────────────────────────────────────
-- 4. Policy RLS — sedi
-- ──────────────────────────────────────────────────────────────
drop policy if exists "sedi: admin all"      on public.sedi;
drop policy if exists "sedi: operatore read" on public.sedi;

create policy "sedi: admin all" on public.sedi
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "sedi: operatore read" on public.sedi
  for select to authenticated
  using (id = public.get_user_sede());


-- ──────────────────────────────────────────────────────────────
-- 5. Policy RLS — profiles
-- ──────────────────────────────────────────────────────────────
drop policy if exists "profiles: self or admin select" on public.profiles;
drop policy if exists "profiles: admin modify"         on public.profiles;

create policy "profiles: self or admin select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles: admin modify" on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ──────────────────────────────────────────────────────────────
-- 6. Trigger: auto-crea profilo al signup
-- ──────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'operatore')
  on conflict (id) do update set email = new.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ──────────────────────────────────────────────────────────────
-- 7. Backfill utenti già esistenti
-- ──────────────────────────────────────────────────────────────
insert into public.profiles (id, role)
select id, 'operatore' from auth.users
on conflict (id) do nothing;

create or replace function public._backfill_emails()
returns void language plpgsql security definer as $$
begin
  update public.profiles p
  set email = u.email
  from auth.users u
  where p.id = u.id and p.email is null;
end;
$$;
select public._backfill_emails();
drop function if exists public._backfill_emails();


-- ──────────────────────────────────────────────────────────────
-- 8. Aggiunge sede_id alle tabelle esistenti
-- ──────────────────────────────────────────────────────────────
alter table public.fornitori add column if not exists sede_id uuid references public.sedi(id) on delete set null;
alter table public.bolle     add column if not exists sede_id uuid references public.sedi(id) on delete set null;
alter table public.fatture   add column if not exists sede_id uuid references public.sedi(id) on delete set null;


-- ──────────────────────────────────────────────────────────────
-- 9. Aggiorna RLS — fornitori
-- ──────────────────────────────────────────────────────────────
drop policy if exists "Authenticated: select fornitori"  on public.fornitori;
drop policy if exists "Authenticated: insert fornitori"  on public.fornitori;
drop policy if exists "Authenticated: update fornitori"  on public.fornitori;
drop policy if exists "Authenticated: delete fornitori"  on public.fornitori;
drop policy if exists "Lettura anon fornitori"           on public.fornitori;

create policy "fornitori: select" on public.fornitori
  for select to authenticated
  using (public.is_admin() or sede_id = public.get_user_sede());

create policy "fornitori: insert" on public.fornitori
  for insert to authenticated
  with check (public.is_admin() or sede_id = public.get_user_sede());

create policy "fornitori: update" on public.fornitori
  for update to authenticated
  using (public.is_admin() or sede_id = public.get_user_sede());

create policy "fornitori: delete" on public.fornitori
  for delete to authenticated
  using (public.is_admin() or sede_id = public.get_user_sede());


-- ──────────────────────────────────────────────────────────────
-- 10. Aggiorna RLS — bolle
-- ──────────────────────────────────────────────────────────────
drop policy if exists "Authenticated: select bolle"  on public.bolle;
drop policy if exists "Authenticated: insert bolle"  on public.bolle;
drop policy if exists "Authenticated: update bolle"  on public.bolle;
drop policy if exists "Authenticated: delete bolle"  on public.bolle;
drop policy if exists "Lettura anon bolle"           on public.bolle;

create policy "bolle: select" on public.bolle
  for select to authenticated
  using (public.is_admin() or sede_id = public.get_user_sede());

create policy "bolle: insert" on public.bolle
  for insert to authenticated
  with check (public.is_admin() or sede_id = public.get_user_sede());

create policy "bolle: update" on public.bolle
  for update to authenticated
  using (public.is_admin() or sede_id = public.get_user_sede());

create policy "bolle: delete" on public.bolle
  for delete to authenticated
  using (public.is_admin() or sede_id = public.get_user_sede());


-- ──────────────────────────────────────────────────────────────
-- 11. Aggiorna RLS — fatture
-- ──────────────────────────────────────────────────────────────
drop policy if exists "Authenticated: select fatture"  on public.fatture;
drop policy if exists "Authenticated: insert fatture"  on public.fatture;
drop policy if exists "Authenticated: update fatture"  on public.fatture;
drop policy if exists "Authenticated: delete fatture"  on public.fatture;

create policy "fatture: select" on public.fatture
  for select to authenticated
  using (public.is_admin() or sede_id = public.get_user_sede());

create policy "fatture: insert" on public.fatture
  for insert to authenticated
  with check (public.is_admin() or sede_id = public.get_user_sede());

create policy "fatture: update" on public.fatture
  for update to authenticated
  using (public.is_admin() or sede_id = public.get_user_sede());

create policy "fatture: delete" on public.fatture
  for delete to authenticated
  using (public.is_admin() or sede_id = public.get_user_sede());


-- ──────────────────────────────────────────────────────────────
-- 12. Promuovi il tuo account ad admin
--     ⚠ SOSTITUISCI l'email con la tua prima di eseguire
-- ──────────────────────────────────────────────────────────────
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'talebarikhan@gmail.com');
