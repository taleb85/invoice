import type { SupabaseClient } from '@supabase/supabase-js'

/** Payload allineato a `/fornitori/new` — usato anche per conferma rapida sulla dashboard */
export type SedeSupplierPrefill = {
  nome: string
  piva: string | null
  indirizzo: string | null
  email: string | null
}

/** Una riga in coda documenti con suggerimento OCR — usata dal banner / drawer dashboard */
export type SedeSupplierSuggestionItem = {
  /** Riga `documenti_da_processare` — per Ignora / refresh */
  documentoId: string
  displayName: string
  prefill: SedeSupplierPrefill
  newFornitoreHref: string
  /** `documenti_da_processare.created_at` (primo ingresso in coda) */
  createdAt: string | null
  mittente: string | null
}

export type SedeSupplierSuggestion = SedeSupplierSuggestionItem | null

type DocMeta = {
  ragione_sociale?: string | null
  p_iva?: string | null
  indirizzo?: string | null
} | null

type FornitoreRow = {
  id: string
  nome: string
  piva: string | null
  email: string | null
  display_name: string | null
}

function normalizePivaDigits(s: string): string {
  return s.replace(/\D/g, '')
}

/** Chiave stabile per confrontare ragioni sociali (spazi, punteggiatura, maiuscole). */
function normalizeSupplierNameKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function normEmail(s: string | null | undefined): string | null {
  const t = s?.trim().toLowerCase()
  return t && t.includes('@') ? t : null
}

/**
 * True se in sede esiste già un fornitore che corrisponde ai dati OCR / mittente
 * (evita banner dopo creazione fornitore mentre il documento resta in coda senza fornitore_id).
 */
function existingFornitoreMatchesDoc(
  fornitori: FornitoreRow[],
  aliasEmailsLower: Set<string>,
  meta: DocMeta,
  mittente: string | null | undefined,
): boolean {
  const pMeta = meta?.p_iva?.trim() ? normalizePivaDigits(meta.p_iva) : ''
  const rsMeta = meta?.ragione_sociale?.trim() ?? ''
  const rsKey = rsMeta.length >= 2 ? normalizeSupplierNameKey(rsMeta) : ''
  const mitt = normEmail(mittente ?? undefined)

  for (const f of fornitori) {
    if (pMeta.length >= 5) {
      const pf = f.piva ? normalizePivaDigits(f.piva) : ''
      if (pf && pf === pMeta) return true
    }
    if (rsKey.length >= 3) {
      if (normalizeSupplierNameKey(f.nome) === rsKey) return true
      if (f.display_name?.trim() && normalizeSupplierNameKey(f.display_name) === rsKey) return true
    }
    const fe = normEmail(f.email ?? undefined)
    if (mitt && fe && fe === mitt) return true
    if (mitt && aliasEmailsLower.has(mitt)) return true
  }
  return false
}

function buildSuggestionFromRow(row: {
  id: string
  metadata: unknown
  mittente: string | null
  created_at?: string | null
}): SedeSupplierSuggestionItem {
  const m = row.metadata as DocMeta
  const rs = m?.ragione_sociale?.trim() ?? ''
  const pivaRaw = m?.p_iva?.trim() ?? ''
  const nomeSupplier = rs || pivaRaw
  const nome = nomeSupplier.length > 72 ? `${nomeSupplier.slice(0, 72)}…` : nomeSupplier
  const displayName = nome

  const mitt = row.mittente?.trim()
  const email = mitt?.includes('@') ? mitt.toLowerCase() : null

  const prefill: SedeSupplierPrefill = {
    nome: nomeSupplier.trim(),
    piva: pivaRaw || null,
    indirizzo: m?.indirizzo?.trim() || null,
    email,
  }

  const q = new URLSearchParams()
  if (rs) q.set('prefill_nome', rs)
  if (pivaRaw) q.set('prefill_piva', pivaRaw)
  if (prefill.indirizzo) q.set('prefill_indirizzo', prefill.indirizzo)
  if (email) q.set('prefill_email', email)
  const qs = q.toString()

  return {
    documentoId: row.id,
    displayName,
    prefill,
    newFornitoreHref: `/fornitori/new?${qs}`,
    createdAt: row.created_at ?? null,
    mittente: row.mittente ?? null,
  }
}

/**
 * Tutti i documenti in coda (sede) senza fornitore ma con hint OCR — per drawer dashboard.
 * Ordine: dal più vecchio al più recente (`created_at` ASC).
 */
export async function fetchAllSedeSupplierSuggestions(
  supabase: SupabaseClient,
  sedeId: string,
  opts?: { excludeDocumentIds?: string[] },
): Promise<SedeSupplierSuggestionItem[]> {
  const exclude = new Set((opts?.excludeDocumentIds ?? []).filter(Boolean))

  const [{ data, error }, { data: fornitoriRows, error: fornErr }] = await Promise.all([
    supabase
      .from('documenti_da_processare')
      .select('id, metadata, mittente, created_at')
      .eq('sede_id', sedeId)
      .is('fornitore_id', null)
      .in('stato', ['da_associare', 'in_attesa'])
      .order('created_at', { ascending: true })
      .limit(60),
    supabase.from('fornitori').select('id, nome, piva, email, display_name').eq('sede_id', sedeId),
  ])

  if (error || !data?.length) return []
  if (fornErr) return []

  const fornitori = (fornitoriRows ?? []) as FornitoreRow[]
  const fornitoreIds = fornitori.map((f) => f.id)
  let aliasEmailsLower = new Set<string>()
  if (fornitoreIds.length > 0) {
    const { data: aliases } = await supabase.from('fornitore_emails').select('email').in('fornitore_id', fornitoreIds)
    aliasEmailsLower = new Set(
      (aliases ?? [])
        .map((a: { email: string }) => a.email?.trim().toLowerCase())
        .filter((e): e is string => !!e?.includes('@')),
    )
  }

  const out: SedeSupplierSuggestionItem[] = []
  for (const raw of data) {
    const d = raw as { id: string; metadata: unknown; mittente: string | null; created_at?: string | null }
    if (exclude.has(d.id)) continue
    const m = d.metadata as DocMeta
    if (!(m?.ragione_sociale?.trim() || m?.p_iva?.trim())) continue
    if (existingFornitoreMatchesDoc(fornitori, aliasEmailsLower, m, d.mittente)) continue
    out.push(buildSuggestionFromRow(d))
  }

  return out
}

/**
 * Primo documento in coda (sede) senza fornitore ma con hint OCR — per banner dashboard operatore.
 * Non propone il fornitore se ne esiste già uno in sede con stessa P.IVA, ragione sociale (normalizzata)
 * o email mittente (profilo o alias).
 */
/** Primo elemento della lista FIFO (GET API / compat). */
export async function fetchSedeSupplierSuggestion(
  supabase: SupabaseClient,
  sedeId: string,
  opts?: { excludeDocumentIds?: string[] },
): Promise<SedeSupplierSuggestion> {
  const all = await fetchAllSedeSupplierSuggestions(supabase, sedeId, opts)
  return all[0] ?? null
}
