-- Polizze su `approval_settings` e `activity_log` per admin_tecnico (dopo part1).
-- npx supabase db query --linked -f supabase/scripts/remote_profiles_admin_tecnico_part2_approval_activity.sql

drop policy if exists "admin_sede can read own approval_settings" on public.approval_settings;

create policy "admin_sede can read own approval_settings"
  on public.approval_settings for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin_sede', 'admin_tecnico')
        and sede_id = approval_settings.sede_id
    )
  );

drop policy if exists "admin_sede can update own approval_settings" on public.approval_settings;

create policy "admin_sede can update own approval_settings"
  on public.approval_settings for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin_sede', 'admin_tecnico')
        and sede_id = approval_settings.sede_id
    )
  );

drop policy if exists "admin_sede can read own sede activity_log" on public.activity_log;

create policy "admin_sede can read own sede activity_log"
  on public.activity_log for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('admin_sede', 'admin_tecnico')
        and sede_id = activity_log.sede_id
    )
  );

select pg_notify('pgrst', 'reload schema');
