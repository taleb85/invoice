-- Dopo `20260413_admin_sede_role.sql`: TALEB era `admin` e non compariva in Operatori.
-- Promuove a responsabile sede (nome+PIN, permessi su quella sede).
update public.profiles
set role = 'admin_sede'
where full_name = 'TALEB'
  and email like '%@interno.fluxo'
  and sede_id is not null;
