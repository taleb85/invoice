-- Rekki: nuovo stato triple-check + RPC badge bolla
ALTER TABLE public.statement_rows DROP CONSTRAINT IF EXISTS statement_rows_check_status_check;

ALTER TABLE public.statement_rows
  ADD CONSTRAINT statement_rows_check_status_check
  CHECK (check_status IN (
    'pending',
    'ok',
    'fattura_mancante',
    'bolle_mancanti',
    'errore_importo',
    'rekki_prezzo_discordanza'
  ));

CREATE OR REPLACE FUNCTION public.bolla_has_rekki_prezzo_flag(p_bolla_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM statement_rows sr,
    LATERAL jsonb_array_elements(COALESCE(sr.bolle_json, '[]'::jsonb)) AS elem
    WHERE (elem->>'id') = p_bolla_id::text
      AND COALESCE((elem->'rekki_meta'->>'prezzo_da_verificare')::boolean, false) = true
  );
$$;

COMMENT ON FUNCTION public.bolla_has_rekki_prezzo_flag(uuid) IS
  'True se la bolla compare in bolle_json con rekki_meta.prezzo_da_verificare (ordine Rekki).';

COMMENT ON COLUMN public.statement_rows.check_status IS
  'Esito triple-check: pending, ok, fattura_mancante, bolle_mancanti, errore_importo, rekki_prezzo_discordanza. Valori non ammessi vanno normalizzati lato app.';

ALTER TABLE public.statement_rows
  ALTER COLUMN check_status SET DEFAULT 'pending';

GRANT EXECUTE ON FUNCTION public.bolla_has_rekki_prezzo_flag(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bolla_has_rekki_prezzo_flag(uuid) TO service_role;

SELECT pg_notify('pgrst', 'reload schema');
