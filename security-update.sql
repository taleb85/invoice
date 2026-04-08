-- =============================================================
-- Security Update – Chiusura falle di test
-- Esegui questo script nell'SQL Editor del tuo progetto Supabase
-- =============================================================

-- =============================================================
-- 1. STORAGE – bucket "documenti"
--    Sostituisce le policy permissive dei test con regole
--    che richiedono un utente autenticato per INSERT e DELETE.
-- =============================================================

-- Rimuovi le vecchie policy aperte
drop policy if exists "Inserimento pubblico documenti"  on storage.objects;
drop policy if exists "Eliminazione pubblica documenti" on storage.objects;

-- INSERT: solo utenti autenticati
create policy "Inserimento autenticato documenti"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documenti');

-- DELETE: solo utenti autenticati
create policy "Eliminazione autenticata documenti"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documenti');

-- SELECT rimane pubblica (invariata, serve per rendere le immagini)


-- =============================================================
-- 2 & 3. RLS + POLICY sulle tabelle applicative
--    Tutte le operazioni sono consentite solo al ruolo
--    "authenticated". Non si filtra per user_id: basta
--    che la richiesta provenga da un utente loggato.
-- =============================================================

-- ── FORNITORI ─────────────────────────────────────────────────
alter table public.fornitori enable row level security;

drop policy if exists "Utente vede i propri fornitori"     on public.fornitori;
drop policy if exists "Utente crea i propri fornitori"     on public.fornitori;
drop policy if exists "Utente aggiorna i propri fornitori" on public.fornitori;
drop policy if exists "Utente elimina i propri fornitori"  on public.fornitori;

create policy "Authenticated: select fornitori"
  on public.fornitori for select to authenticated using (true);

create policy "Authenticated: insert fornitori"
  on public.fornitori for insert to authenticated with check (true);

create policy "Authenticated: update fornitori"
  on public.fornitori for update to authenticated using (true);

create policy "Authenticated: delete fornitori"
  on public.fornitori for delete to authenticated using (true);


-- ── BOLLE ─────────────────────────────────────────────────────
alter table public.bolle enable row level security;

drop policy if exists "Utente vede le proprie bolle"     on public.bolle;
drop policy if exists "Utente crea le proprie bolle"     on public.bolle;
drop policy if exists "Utente aggiorna le proprie bolle" on public.bolle;
drop policy if exists "Utente elimina le proprie bolle"  on public.bolle;

create policy "Authenticated: select bolle"
  on public.bolle for select to authenticated using (true);

create policy "Authenticated: insert bolle"
  on public.bolle for insert to authenticated with check (true);

create policy "Authenticated: update bolle"
  on public.bolle for update to authenticated using (true);

create policy "Authenticated: delete bolle"
  on public.bolle for delete to authenticated using (true);


-- ── FATTURE ───────────────────────────────────────────────────
alter table public.fatture enable row level security;

drop policy if exists "Utente vede le proprie fatture"     on public.fatture;
drop policy if exists "Utente crea le proprie fatture"     on public.fatture;
drop policy if exists "Utente aggiorna le proprie fatture" on public.fatture;
drop policy if exists "Utente elimina le proprie fatture"  on public.fatture;

create policy "Authenticated: select fatture"
  on public.fatture for select to authenticated using (true);

create policy "Authenticated: insert fatture"
  on public.fatture for insert to authenticated with check (true);

create policy "Authenticated: update fatture"
  on public.fatture for update to authenticated using (true);

create policy "Authenticated: delete fatture"
  on public.fatture for delete to authenticated using (true);
