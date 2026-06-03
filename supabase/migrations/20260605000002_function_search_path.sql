-- Supabase advisor: function_search_path_mutable (lint 0011)

ALTER FUNCTION public.map_verifica_action_to_azione_id(text) SET search_path = public;
ALTER FUNCTION public.comunicazioni_fornitori_potenziali_updated_at() SET search_path = public;
ALTER FUNCTION public.calcola_confidenza_suggerimento(uuid, uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.upsert_action_learning(uuid, uuid, jsonb, text, boolean, boolean) SET search_path = public;
ALTER FUNCTION public.refresh_materialized_view(text) SET search_path = public;
ALTER FUNCTION public.sync_verifica_action_to_ai_learning() SET search_path = public;
