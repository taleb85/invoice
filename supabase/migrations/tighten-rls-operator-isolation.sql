-- ============================================================
-- tighten-rls-operator-isolation.sql
-- Eseguire nel SQL Editor di Supabase (dopo fix-rls-bolle-fatture-via-fornitore-sede.sql)
-- ============================================================
-- Obiettivo:
-- 1) Operatori: niente SELECT su bolle/fatture solo perché sede_id è NULL (cross-sede).
-- 2) Operatori: log_sincronizzazione solo con fornitore_id della propria sede (niente log "anonimi").
-- 3) Admin: invariata la visibilità completa tramite is_admin().
-- ============================================================

-- ── bolle ──────────────────────────────────────────────────
drop policy if exists "bolle: select" on public.bolle;
create policy "bolle: select" on public.bolle
  for select to authenticated
  using (
    public.is_admin()
    or sede_id = public.get_user_sede()
    or exists (
      select 1
      from public.fornitori f
      where f.id = bolle.fornitore_id
        and f.sede_id = public.get_user_sede()
    )
  );

drop policy if exists "bolle: update" on public.bolle;
create policy "bolle: update" on public.bolle
  for update to authenticated
  using (
    public.is_admin()
    or sede_id = public.get_user_sede()
    or exists (
      select 1
      from public.fornitori f
      where f.id = bolle.fornitore_id
        and f.sede_id = public.get_user_sede()
    )
  );

-- ── fatture ─────────────────────────────────────────────────
drop policy if exists "fatture: select" on public.fatture;
create policy "fatture: select" on public.fatture
  for select to authenticated
  using (
    public.is_admin()
    or sede_id = public.get_user_sede()
    or exists (
      select 1
      from public.fornitori f
      where f.id = fatture.fornitore_id
        and f.sede_id = public.get_user_sede()
    )
  );

drop policy if exists "fatture: update" on public.fatture;
create policy "fatture: update" on public.fatture
  for update to authenticated
  using (
    public.is_admin()
    or sede_id = public.get_user_sede()
    or exists (
      select 1
      from public.fornitori f
      where f.id = fatture.fornitore_id
        and f.sede_id = public.get_user_sede()
    )
  );

-- ── log_sincronizzazione ────────────────────────────────────
drop policy if exists "log: select" on public.log_sincronizzazione;
drop policy if exists "Authenticated: select log" on public.log_sincronizzazione;

create policy "log: select" on public.log_sincronizzazione
  for select to authenticated
  using (
    public.is_admin()
    or (
      fornitore_id is not null
      and fornitore_id in (
        select id from public.fornitori where sede_id = public.get_user_sede()
      )
    )
  );
