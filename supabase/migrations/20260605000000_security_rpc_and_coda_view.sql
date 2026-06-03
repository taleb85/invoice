-- Hardening sicurezza (Supabase advisors 2026-06-05)
-- 1) RPC admin/sender solo service_role (API usa createServiceClient)
-- 2) Revoca anon su RPC sensibili ancora eseguibili da PostgREST
-- 3) Vista coda con security_invoker (RLS dell'utente che interroga)

-- ── RPC audit inbox: solo backend ───────────────────────────────────────────
REVOKE ALL ON FUNCTION public.admin_audit_fornitore_match(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_audit_fornitore_match(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_audit_fornitore_match(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.sender_known_for_fornitore(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sender_known_for_fornitore(uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sender_known_for_fornitore(uuid, text, text) TO service_role;

-- ── RPC: niente esecuzione anon (authenticated resta dove serve la UI) ────
REVOKE EXECUTE ON FUNCTION public.calcola_confidenza_suggerimento(uuid, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_action_learning(uuid, uuid, jsonb, text, boolean, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_materialized_view(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_verifica_action_to_ai_learning() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_of_sede(uuid) FROM anon;

-- ── Vista coda: rispetta RLS del chiamante (PG15+) ──────────────────────────
ALTER VIEW public.v_coda_unificata SET (security_invoker = true);

SELECT pg_notify('pgrst', 'reload schema');
