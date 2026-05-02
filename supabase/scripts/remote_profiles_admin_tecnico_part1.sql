-- One-off DB parziali: allinea CHECK + RLS dove `profiles`/`sedi`/`documenti_da_processare` esistono
-- ma `configurazioni_app`/`configurazioni_solleciti` no. Eseguito con:
-- npx supabase db query --linked -f supabase/scripts/remote_profiles_admin_tecnico_part1.sql

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
    check (role in ('admin', 'admin_sede', 'admin_tecnico', 'operatore'));

comment on column public.profiles.role is
  'admin = master tutte sedi; admin_sede = gestione completa sulla sede_id; admin_tecnico = operatività tecnica sede senza gestione utenti altrui; operatore = banco/PIN';

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
