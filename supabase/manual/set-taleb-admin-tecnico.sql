-- Esegui tutto il blocco nell’SQL Editor di Supabase (progetto collegato all’app).
-- 1) Estende il CHECK su profiles.role (se manca, l’UPDATE fallisce come in app/node script).
-- 2) Forza admin_tecnico per l’operatore TALEB con email interna.

alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'admin_sede', 'admin_tecnico', 'operatore'));

comment on column public.profiles.role is 'admin = master; admin_sede / admin_tecnico = gestione sede assegnata (varianti permesso); operatore = operativo';

update public.profiles
set role = 'admin_tecnico'
where sede_id is not null
  and email like '%@interno.fluxo'
  and upper(trim(full_name)) like '%taleb%';

-- Verifica
select id, full_name, email, role, sede_id
from public.profiles
where upper(trim(full_name)) like '%taleb%'
   or email ilike '%taleb%';
