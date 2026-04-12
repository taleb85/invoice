-- Consenti SELECT/UPDATE su bolle e fatture se il fornitore collegato è della sede
-- dell’utente, anche quando bolle.sede_id / fatture.sede_id è NULL o disallineato.
-- Così si possono aprire scheda e allegato (file_url) senza “non trovato” spurio.

drop policy if exists "bolle: select" on public.bolle;
create policy "bolle: select" on public.bolle
  for select to authenticated
  using (
    public.is_admin()
    or sede_id = public.get_user_sede()
    or sede_id is null
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
    or sede_id is null
    or exists (
      select 1
      from public.fornitori f
      where f.id = bolle.fornitore_id
        and f.sede_id = public.get_user_sede()
    )
  );

drop policy if exists "fatture: select" on public.fatture;
create policy "fatture: select" on public.fatture
  for select to authenticated
  using (
    public.is_admin()
    or sede_id = public.get_user_sede()
    or sede_id is null
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
    or sede_id is null
    or exists (
      select 1
      from public.fornitori f
      where f.id = fatture.fornitore_id
        and f.sede_id = public.get_user_sede()
    )
  );
