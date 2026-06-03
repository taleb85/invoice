-- Revoca EXECUTE da PUBLIC (anon eredita PUBLIC) sulle RPC SECURITY DEFINER esposte.

REVOKE ALL ON FUNCTION public.calcola_confidenza_suggerimento(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calcola_confidenza_suggerimento(uuid, uuid, jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.upsert_action_learning(uuid, uuid, jsonb, text, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_action_learning(uuid, uuid, jsonb, text, boolean, boolean) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_admin_of_sede(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_of_sede(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.refresh_materialized_view(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_materialized_view(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_materialized_view(text) TO service_role;

REVOKE ALL ON FUNCTION public.sync_verifica_action_to_ai_learning() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_verifica_action_to_ai_learning() FROM authenticated;

SELECT pg_notify('pgrst', 'reload schema');
