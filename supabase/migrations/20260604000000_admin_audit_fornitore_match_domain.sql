-- Esclude dall’audit i mittenti il cui dominio è già noto per il fornitore assegnato
-- (es. accounts@carnevale.co.uk → anche noreply@carnevale.co.uk), come in resolveFornitoreFromScanEmail.

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
    AND NOT public.sender_known_for_fornitore(
      doc.assigned_fornitore_id,
      doc.mittente_email,
      doc.mittente_domain
    )
  ORDER BY doc.created_at DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.sender_known_for_fornitore(
  p_fornitore_id uuid,
  p_mittente_email text,
  p_mittente_domain text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM fornitore_emails fe
      WHERE fe.fornitore_id = p_fornitore_id
        AND fe.email IS NOT NULL
        AND lower(trim(fe.email)) = p_mittente_email
    )
    OR EXISTS (
      SELECT 1
      FROM fornitori f
      WHERE f.id = p_fornitore_id
        AND f.email IS NOT NULL
        AND lower(trim(f.email)) = p_mittente_email
    )
    OR (
      p_mittente_domain <> ''
      AND p_mittente_domain NOT IN (
        'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
        'icloud.com', 'libero.it', 'pec.it', 'legalmail.it', 'aruba.it',
        'msn.com', 'proton.me', 'protonmail.com', 'me.com', 'tiscali.it',
        'alice.it', 'tim.it', 'poste.it', 'email.it'
      )
      AND (
        EXISTS (
          SELECT 1
          FROM fornitore_emails fe
          WHERE fe.fornitore_id = p_fornitore_id
            AND fe.email IS NOT NULL
            AND lower(split_part(trim(fe.email), '@', 2)) = p_mittente_domain
        )
        OR EXISTS (
          SELECT 1
          FROM fornitori f
          WHERE f.id = p_fornitore_id
            AND f.email IS NOT NULL
            AND lower(split_part(trim(f.email), '@', 2)) = p_mittente_domain
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.admin_audit_fornitore_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_audit_fornitore_match(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.sender_known_for_fornitore(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sender_known_for_fornitore(uuid, text, text) TO service_role;
