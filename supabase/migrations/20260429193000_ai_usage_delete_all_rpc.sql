-- Azzeramento completo ai_usage_log (solo service_role via PostgREST RPC).
-- Evita edge case PostgREST/RLS su DELETE con filtri su timestamp.

CREATE OR REPLACE FUNCTION public.delete_all_ai_usage_log()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  DELETE FROM public.ai_usage_log;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_all_ai_usage_log() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_all_ai_usage_log() TO service_role;

COMMENT ON FUNCTION public.delete_all_ai_usage_log IS
  'Elimina tutte le righe da ai_usage_log. Chiamabile solo con service_role (route admin).';
