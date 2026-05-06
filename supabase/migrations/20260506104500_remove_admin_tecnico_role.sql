-- Elimina ruolo profiles.role = 'admin_tecnico': sposta chi lo aveva su admin_sede e restringe il CHECK.

update public.profiles
set role = 'admin_sede'
where lower(trim(role::text)) = 'admin_tecnico';

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'admin_sede', 'operatore'));

comment on column public.profiles.role is 'admin = master; admin_sede = gestione sede assegnata; operatore = operativo';
