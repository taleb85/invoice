-- Ruolo tecnico sulla sede: stessi accessi tecnici degli admin sede tramite codice applicativo,
-- salvo gestione utenti riservata a `admin_sede` / master (`create-user`, PATCH profili altrui, ecc.).

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
    check (role in ('admin', 'admin_sede', 'admin_tecnico', 'operatore'));

comment on column public.profiles.role is
  'admin = master tutte sedi; admin_sede = gestione completa sulla sede_id; admin_tecnico = operatività tecnica sede senza gestione utenti altrui; operatore = banco/PIN';

-- ── RLS / helper (allineamento a admin_sede per la stessa sede_id) ────────────

create or replace function public.is_admin_of_sede(target_sede_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and (
        role = 'admin'
        or (
          role in ('admin_sede', 'admin_tecnico')
          and sede_id is not distinct from target_sede_id
        )
      )
  )
$$;

drop policy if exists "profiles_select_admin_sede" on public.profiles;

create policy "profiles_select_admin_sede"
on public.profiles for select
using (
  exists (
    select 1 from public.profiles as caller
    where caller.id = auth.uid()
      and caller.role in ('admin_sede', 'admin_tecnico')
      and caller.sede_id is not distinct from profiles.sede_id
  )
);

drop policy if exists "sedi_update_admin_sede" on public.sedi;

create policy "sedi_update_admin_sede"
on public.sedi for update
using (
  exists (
    select 1 from public.profiles as caller
    where caller.id = auth.uid()
      and caller.role in ('admin_sede', 'admin_tecnico')
      and caller.sede_id = sedi.id
  )
);

drop policy if exists "documenti_select_no_sede" on public.documenti_da_processare;

create policy "documenti_select_no_sede"
on public.documenti_da_processare for select
using (
  sede_id is null
  and exists (
    select 1 from public.profiles as caller
    where caller.id = auth.uid()
      and caller.role in ('admin', 'admin_sede', 'admin_tecnico')
  )
);

-- approval_settings (stessa sede)
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
