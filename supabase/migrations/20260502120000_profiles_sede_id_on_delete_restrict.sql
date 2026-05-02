-- Impedisce di eliminare una sede se `profiles.sede_id` la referenzia ancora.
-- Prima: ON DELETE SET NULL lasciava operatori senza filiale → dashboard vuota e RLS bloccata.

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_sede_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_sede_id_fkey
  FOREIGN KEY (sede_id) REFERENCES public.sedi(id) ON DELETE RESTRICT;
