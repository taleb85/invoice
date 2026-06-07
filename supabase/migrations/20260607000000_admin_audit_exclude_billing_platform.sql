-- Esclude dall’audit i mittenti QuickBooks/Xero: indirizzo condiviso, non associabile al fornitore.

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
  WITH doc AS (
    SELECT
      d.id,
      d.created_at,
      coalesce(trim(d.mittente::text), '')::text AS mittente_raw,
      d.file_name::text,
      d.fattura_id,
      d.bolla_id,
      coalesce(fat.fornitore_id, bol.fornitore_id) AS assigned_fornitore_id,
      f_fat.nome::text AS fornitore_fattura,
      f_bol.nome::text AS fornitore_bolla,
      lower(
        trim(
          coalesce(
            substring(trim(d.mittente::text) from '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-zA-Z]{2,}'),
            trim(d.mittente::text)
          )
        )
      ) AS mittente_email,
      lower(
        split_part(
          trim(
            coalesce(
              substring(trim(d.mittente::text) from '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-zA-Z]{2,}'),
              trim(d.mittente::text)
            )
          ),
          '@',
          2
        )
      ) AS mittente_domain
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
  )
  SELECT
    doc.id,
    doc.mittente_raw,
    doc.file_name,
    doc.fattura_id,
    doc.bolla_id,
    doc.assigned_fornitore_id,
    doc.fornitore_fattura,
    doc.fornitore_bolla
  FROM doc
  WHERE doc.assigned_fornitore_id IS NOT NULL
    AND doc.mittente_email LIKE '%@%'
    AND doc.mittente_domain NOT IN (
      'post.xero.com',
      'eumessaging.xero.com',
      'notification.intuit.com',
      'notifications.intuit.com'
    )
    AND NOT public.sender_known_for_fornitore(
      doc.assigned_fornitore_id,
      doc.mittente_email,
      doc.mittente_domain
    )
  ORDER BY doc.created_at DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.admin_audit_fornitore_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_audit_fornitore_match(uuid) TO service_role;
