-- Function to refresh materialized view (called from API)
CREATE OR REPLACE FUNCTION refresh_materialized_view(view_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE format('REFRESH MATERIALIZED VIEW %I', view_name);
END;
$$;

COMMENT ON FUNCTION refresh_materialized_view IS 'Refreshes a materialized view by name (security definer for RLS bypass)';
