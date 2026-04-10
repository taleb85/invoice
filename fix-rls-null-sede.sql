-- ============================================================
-- fix-rls-null-sede.sql
-- Eseguire nel SQL Editor di Supabase
-- ============================================================
-- Problema: le policy RLS usano "sede_id = get_user_sede()".
-- In SQL, NULL = NULL è NULL (non TRUE), quindi i record con
-- sede_id = NULL (creati prima della migrazione multi-sede
-- o da global IMAP senza sede) sono INVISIBILI e non
-- aggiornabili dagli operatori non-admin.
--
-- Questa patch aggiunge "OR sede_id IS NULL" alle policy
-- SELECT e UPDATE per bolle, fatture e documenti_da_processare.
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. bolle — SELECT e UPDATE
-- ──────────────────────────────────────────────────────────────
drop policy if exists "bolle: select" on public.bolle;
create policy "bolle: select" on public.bolle
  for select to authenticated
  using (
    public.is_admin()
    or sede_id = public.get_user_sede()
    or sede_id is null   -- retrocompatibilità: bolle senza sede
  );

drop policy if exists "bolle: update" on public.bolle;
create policy "bolle: update" on public.bolle
  for update to authenticated
  using (
    public.is_admin()
    or sede_id = public.get_user_sede()
    or sede_id is null   -- permette di aggiornare bolle senza sede (es. completato)
  );


-- ──────────────────────────────────────────────────────────────
-- 2. fatture — SELECT e UPDATE
-- ──────────────────────────────────────────────────────────────
drop policy if exists "fatture: select" on public.fatture;
create policy "fatture: select" on public.fatture
  for select to authenticated
  using (
    public.is_admin()
    or sede_id = public.get_user_sede()
    or sede_id is null
  );

drop policy if exists "fatture: update" on public.fatture;
create policy "fatture: update" on public.fatture
  for update to authenticated
  using (
    public.is_admin()
    or sede_id = public.get_user_sede()
    or sede_id is null
  );


-- ──────────────────────────────────────────────────────────────
-- 3. documenti_da_processare — SELECT e UPDATE
-- ──────────────────────────────────────────────────────────────
drop policy if exists "documenti_processare: select" on public.documenti_da_processare;
create policy "documenti_processare: select" on public.documenti_da_processare
  for select to authenticated
  using (
    public.is_admin()
    or sede_id = public.get_user_sede()
    or sede_id is null   -- documenti da global IMAP o mittente sconosciuto
  );

drop policy if exists "documenti_processare: update" on public.documenti_da_processare;
create policy "documenti_processare: update" on public.documenti_da_processare
  for update to authenticated
  using (
    public.is_admin()
    or sede_id = public.get_user_sede()
    or sede_id is null   -- permette di "adottare" un documento senza sede
  );


-- ──────────────────────────────────────────────────────────────
-- 4. (Opzionale) Backfill: assegna la sede a tutti i record
--    che ne sono privi, se esiste una sola sede nel sistema.
--    Decommenta ed esegui solo se hai una sede unica.
-- ──────────────────────────────────────────────────────────────
-- do $$
-- declare
--   v_sede_id uuid;
-- begin
--   select id into v_sede_id from public.sedi limit 1;
--   if v_sede_id is not null then
--     update public.bolle   set sede_id = v_sede_id where sede_id is null;
--     update public.fatture set sede_id = v_sede_id where sede_id is null;
--     update public.documenti_da_processare set sede_id = v_sede_id where sede_id is null;
--     raise notice 'Backfill completato: sede_id = %', v_sede_id;
--   end if;
-- end $$;

