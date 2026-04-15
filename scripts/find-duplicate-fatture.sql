-- =============================================================================
-- Trova fatture duplicate già salvate (stessa logica dell’app)
-- =============================================================================
-- Chiave duplicato: stesso fornitore + stessa data documento + stesso numero
-- fattura normalizzato (spazi compressi, confronto case-insensitive) + stessa sede
-- (inclusi entrambi NULL su sede_id).
--
-- Come usarlo:
-- 1. Apri Supabase → SQL Editor → New query
-- 2. Seleziona ed esegui **solo** il blocco «QUERY A» (tutto fino al commento QUERY B).
-- 3. Poi, se ti servono importi e URL: seleziona ed esegui **solo** il blocco «QUERY B**.
--
-- Non modifica dati: solo SELECT.
-- =============================================================================

-- ═══════════════════════════════════════════════════════════════════════════
-- QUERY A — Riepilogo: gruppi con più di una fattura
-- ═══════════════════════════════════════════════════════════════════════════
WITH norm AS (
  SELECT
    id,
    fornitore_id,
    sede_id,
    data,
    numero_fattura,
    created_at,
    lower(
      regexp_replace(trim(numero_fattura), '\s+', ' ', 'g')
    ) AS num_norm
  FROM public.fatture
  WHERE numero_fattura IS NOT NULL
    AND trim(numero_fattura) <> ''
),
dup_keys AS (
  SELECT
    sede_id,
    fornitore_id,
    data,
    num_norm,
    count(*)::int AS quante,
    min(created_at) AS prima_creazione,
    max(created_at) AS ultima_creazione
  FROM norm
  GROUP BY sede_id, fornitore_id, data, num_norm
  HAVING count(*) > 1
)
SELECT
  d.quante AS fatture_nel_gruppo,
  d.data AS data_documento,
  d.num_norm AS numero_normalizzato,
  f.nome AS fornitore,
  s.nome AS sede,
  d.sede_id,
  d.fornitore_id,
  d.prima_creazione,
  d.ultima_creazione,
  (
    SELECT array_agg(n.id ORDER BY n.created_at)
    FROM norm n
    WHERE n.sede_id IS NOT DISTINCT FROM d.sede_id
      AND n.fornitore_id = d.fornitore_id
      AND n.data = d.data
      AND n.num_norm = d.num_norm
  ) AS ids_fattura
FROM dup_keys d
LEFT JOIN public.fornitori f ON f.id = d.fornitore_id
LEFT JOIN public.sedi s ON s.id = d.sede_id
ORDER BY d.quante DESC, d.ultima_creazione DESC;


-- ═══════════════════════════════════════════════════════════════════════════
-- QUERY B — Dettaglio: ogni riga duplicata (importi, URL, bolla, date creazione)
-- ═══════════════════════════════════════════════════════════════════════════

WITH norm AS (
  SELECT
    id,
    fornitore_id,
    sede_id,
    data,
    numero_fattura,
    importo,
    file_url,
    bolla_id,
    created_at,
    lower(regexp_replace(trim(numero_fattura), '\s+', ' ', 'g')) AS num_norm
  FROM public.fatture
  WHERE numero_fattura IS NOT NULL
    AND trim(numero_fattura) <> ''
),
dup_keys AS (
  SELECT sede_id, fornitore_id, data, num_norm
  FROM norm
  GROUP BY sede_id, fornitore_id, data, num_norm
  HAVING count(*) > 1
)
SELECT
  n.id,
  n.data,
  n.numero_fattura AS numero_raw,
  n.num_norm,
  n.importo,
  left(n.file_url, 80) AS file_url_anteprima,
  n.bolla_id,
  n.created_at,
  f.nome AS fornitore,
  s.nome AS sede
FROM norm n
INNER JOIN dup_keys d
  ON n.sede_id IS NOT DISTINCT FROM d.sede_id
 AND n.fornitore_id = d.fornitore_id
 AND n.data = d.data
 AND n.num_norm = d.num_norm
LEFT JOIN public.fornitori f ON f.id = n.fornitore_id
LEFT JOIN public.sedi s ON s.id = n.sede_id
ORDER BY n.fornitore_id, n.data, n.num_norm, n.created_at;
