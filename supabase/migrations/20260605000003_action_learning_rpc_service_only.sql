-- Apprendimento AI: RPC solo via API (service_role), non più da PostgREST client.

REVOKE ALL ON FUNCTION public.calcola_confidenza_suggerimento(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calcola_confidenza_suggerimento(uuid, uuid, jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.calcola_confidenza_suggerimento(uuid, uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.upsert_action_learning(uuid, uuid, jsonb, text, boolean, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_action_learning(uuid, uuid, jsonb, text, boolean, boolean) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_action_learning(uuid, uuid, jsonb, text, boolean, boolean) TO service_role;

-- Helper RLS: revoca anon/PUBLIC; authenticated deve restare (policy fornitori/bolle/…).
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_user_sede() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_sede() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_user_sede() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_admin_of_sede(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin_of_sede(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin_of_sede(uuid) TO authenticated, service_role;

SELECT pg_notify('pgrst', 'reload schema');
