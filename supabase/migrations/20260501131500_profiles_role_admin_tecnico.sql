-- Estende profiles.role con admin_tecnico (amministratore tecnico di sede).
-- Allinea il CHECK a quanto già gestito dall’app; senza questo, aggiornamenti profilo falliscono nel DB.

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'admin_sede', 'admin_tecnico', 'operatore'));

comment on column public.profiles.role is 'admin = master; admin_sede / admin_tecnico = gestione sede assegnata (varianti permesso); operatore = operativo';
