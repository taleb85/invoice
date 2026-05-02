-- Eseguire solo quando esistono `public.configurazioni_app` e `public.configurazioni_solleciti`
-- (stesso contenuto finale di migrations/20260501140000_profiles_role_admin_tecnico.sql).
-- npx supabase db query --linked -f supabase/scripts/remote_profiles_admin_tecnico_part3_configurazioni.sql

drop policy if exists configurazioni_app_staff_write on public.configurazioni_app;

create policy configurazioni_app_staff_write
  on public.configurazioni_app
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'admin_sede', 'admin_tecnico')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'admin_sede', 'admin_tecnico')
    )
  );

drop policy if exists configurazioni_solleciti_staff_write on public.configurazioni_solleciti;

create policy configurazioni_solleciti_staff_write
  on public.configurazioni_solleciti
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'admin_sede', 'admin_tecnico')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'admin_sede', 'admin_tecnico')
    )
  );

select pg_notify('pgrst', 'reload schema');
