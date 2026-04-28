-- Lista documenti già salvati (`associato`) il cui mittente non è registrato in fornitore_emails per il fornitore collegato.

CREATE OR REPLACE FUNCTION public.admin_audit_fornitore_match(p_sede_id uuid)
RETURNS TABLE (
  id uuid,
  mittente text,
  file_name text,
  fattura_id uuid,
  bolla_id uuid,
  assigned_fornitore_id uuid,
  fornitore_fattura text,
  fornitore_bolla text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id,
    coalesce(trim(d.mittente::text), '')::text,
    d.file_name::text,
    d.fattura_id,
    d.bolla_id,
    coalesce(fat.fornitore_id, bol.fornitore_id) AS assigned_fornitore_id,
    f_fat.nome::text,
    f_bol.nome::text
  FROM documenti_da_processare d
  LEFT JOIN fatture fat ON fat.id = d.fattura_id
  LEFT JOIN bolle bol ON bol.id = d.bolla_id
  LEFT JOIN fornitori f_fat ON f_fat.id = fat.fornitore_id
  LEFT JOIN fornitori f_bol ON f_bol.id = bol.fornitore_id
  WHERE d.stato = 'associato'
    AND d.mittente IS NOT NULL
    AND trim(d.mittente::text) <> ''
    AND d.sede_id = p_sede_id
    AND (d.fattura_id IS NOT NULL OR d.bolla_id IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1
      FROM fornitore_emails fe
      WHERE (
          fe.fornitore_id = fat.fornitore_id
          OR fe.fornitore_id = bol.fornitore_id
        )
        AND fe.email IS NOT NULL
        AND lower(trim(fe.email)) = lower(
          trim(
            coalesce(
              substring(trim(d.mittente::text) from '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-zA-Z]{2,}'),
              trim(d.mittente::text)
            )
          )
        )
    )
  ORDER BY d.created_at DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.admin_audit_fornitore_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_audit_fornitore_match(uuid) TO service_role;
