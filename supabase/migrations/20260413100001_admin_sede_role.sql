-- Aggiunge il ruolo admin_sede ai profili (responsabile di sede, permessi completi ma solo sulla propria sede_id).
-- Eseguire nell'SQL Editor di Supabase dopo backup.
--
-- Aggiorna il CHECK sulla colonna role (nome constraint tipico da multi-sede.sql: profiles_role_check).

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'admin_sede', 'operatore'));

comment on column public.profiles.role is 'admin = master; admin_sede = gestione sede assegnata; operatore = operativo';
