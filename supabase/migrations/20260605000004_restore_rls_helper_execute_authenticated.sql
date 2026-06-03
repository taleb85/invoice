-- Le policy RLS chiamano is_admin / get_user_sede / is_admin_of_sede nelle espressioni:
-- authenticated deve poterle eseguire (non solo via RPC PostgREST).
-- Revoca resta su PUBLIC/anon; RPC sensibili restano service_role-only.

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_sede() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of_sede(uuid) TO authenticated;

SELECT pg_notify('pgrst', 'reload schema');
