import type { SupabaseClient } from '@supabase/supabase-js'

export type OcrMetaForMatch = {
  ragione_sociale?: string | null
  p_iva?: string | null
  indirizzo?: string | null
}

/** Stable key for matching OCR vs anagrafica addresses (accents, punctuation, spacing). */
export function normalizeAddressKey(indirizzo: string | null | undefined): string | null {
  const t = indirizzo?.trim()
  if (!t || t.length < 12) return null
  const k = t
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  return k.length >= 12 ? k : null
}

function normalizePivaDigits(s: string): string {
  return s.replace(/\D/g, '')
}

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

/** Dopo `normalizeSupplierNameKey`: Ltd ≈ Limited (OCR vs anagrafica), Inc, SRL … */
function canonicalSupplierNameKey(raw: string): string {
  let s = normalizeSupplierNameKey(raw)
  if (!s) return s
  s = s.replace(/\b(limited|ltd)\b/g, 'ltd')
  s = s.replace(/\b(incorporated|inc)\b/g, 'inc')
  s = s.replace(/\b(s\.r\.l\.|srl|s r l)\b/g, 'srl')
  s = s.replace(/\b(plc|plc\.)\b/g, 'plc')
  return s.replace(/\s+/g, ' ').trim()
}

/** Data o residuo data in coda (es. "30/04/2025" o "- 30/04/2025") */
function trimTrailingLooseDateFragment(s: string): string {
  return s.replace(/\s*[,-]?\s*\d{1,4}[/.-]\d{1,2}[/.-]\d{2,4}(?:[^\p{L}\p{N}]*)$/u, '').trim()
}

/**
 * OCR spesso concatena numero fattura + "from Supplier - sede/località - data".
 * La chiave canonica dell’intera stringa ≠ anagrafica ("Ital Cutlery"); proviamo
 * segmenti e strip "INV … from".
 */
function ragioneSocialeCandidatesForMatch(rsTrim: string): string[] {
  const seen = new Set<string>()
  const addChunk = (chunk: string) => {
    const c1 = trimTrailingLooseDateFragment(chunk)
    let c = c1.trim()
    while (/-$/.test(c)) {
      const x = trimTrailingLooseDateFragment(c.slice(0, -1).trim())
      c = x.replace(/-+$/,'').trim()
    }
    if (!c) return
    let k = canonicalSupplierNameKey(c)
    if (k.length >= 3) seen.add(k)
    const sansInv = c.replace(/^INV\s*#?\s*[A-Za-z0-9/]*\s*\d+\s+from\s+/i, '').trim()
    if (sansInv && sansInv !== c) {
      k = canonicalSupplierNameKey(sansInv)
      if (k.length >= 3) seen.add(k)
    }
  }

  const work = rsTrim.trim()
  if (!work) return []

  addChunk(work)

  const parts = work.split(/\s+-\s+|\s*[|•]\s*/u)
  for (const p of parts) {
    if (p.trim()) addChunk(p.trim())
  }

  const leadOff = work.replace(/^INV\s*#?\s*[A-Za-z0-9/]*\s*\d+\s+from\s+/i, '').trim()
  if (leadOff && leadOff !== work) addChunk(leadOff)

  return [...seen].sort((a, b) => b.length - a.length)
}

function normEmail(s: string | null | undefined): string | null {
  const t = s?.trim().toLowerCase()
  return t && t.includes('@') ? t : null
}

type FornitoreMatchRow = {
  id: string
  nome: string
  piva: string | null
  display_name: string | null
  email: string | null
  indirizzo: string | null
}

async function resolveEffectiveSedeId(
  supabase: SupabaseClient,
  opts: {
    docSedeId?: string | null
    fallbackSedeId?: string | null
    profileSedeId?: string | null
    fornitoreFilterId?: string | null
  },
): Promise<string | null> {
  const fromDoc = opts.docSedeId ?? opts.fallbackSedeId ?? opts.profileSedeId ?? null
  if (fromDoc) return fromDoc
  if (opts.fornitoreFilterId) {
    const { data: row } = await supabase.from('fornitori').select('sede_id').eq('id', opts.fornitoreFilterId).maybeSingle()
    return row?.sede_id ?? null
  }
  return null
}

/**
 * Unique supplier in sede scope via P.IV.A., sender email/alias, address or name.
 * When scope sede is unknown (global queue, admin view) but OCR has a VAT number that
 * matches exactly one visible `fornitori` row, links anyway (cross-sede VAT fallback).
 */
export async function findUniqueFornitoreForPendingDoc(
  supabase: SupabaseClient,
  opts: {
    docSedeId?: string | null
    fallbackSedeId?: string | null
    profileSedeId?: string | null
    fornitoreFilterId?: string | null
    metadata: OcrMetaForMatch | null | undefined
    mittente?: string | null
  },
): Promise<{ id: string; nome: string } | null> {
  const meta = opts.metadata
  const pTrim = meta?.p_iva?.trim()
  const rsTrim = meta?.ragione_sociale?.trim()
  const ocrAddrKey = normalizeAddressKey(meta?.indirizzo)
  const pDigits = pTrim ? normalizePivaDigits(pTrim) : ''
  if (!pTrim && !rsTrim && !normEmail(opts.mittente) && !ocrAddrKey) return null

  const sedeId = await resolveEffectiveSedeId(supabase, opts)

  /**
   * Record con `sede_id` NULL (mittente sconosciuto / IMAP globale) e vista senza sede
   * (admin master): la partita IVA univoca nell’anagrafica visibile (RLS) basta per collegare
   * senza scope sede — prima `!sedeId` faceva fallire sempre l’auto-link.
   */
  if (!sedeId && pDigits.length >= 5) {
    const { data: pivaRows } = await supabase.from('fornitori').select('id, nome, piva').not('piva', 'is', null)
    const gvHits = pivaRows?.filter((f) => f.piva && normalizePivaDigits(f.piva) === pDigits) ?? []
    if (gvHits.length === 1) return { id: gvHits[0].id, nome: gvHits[0].nome }
  }

  if (!sedeId) return null

  const { data: rows, error } = await supabase
    .from('fornitori')
    .select('id, nome, piva, display_name, email, indirizzo')
    .eq('sede_id', sedeId)

  if (error || !rows?.length) return null

  const list = rows as FornitoreMatchRow[]

  if (pDigits.length >= 5) {
    const hits = list.filter((f) => f.piva && normalizePivaDigits(f.piva) === pDigits)
    if (hits.length === 1) return { id: hits[0].id, nome: hits[0].nome }
    if (hits.length > 1) return null
  }

  const mitt = normEmail(opts.mittente)
  if (mitt) {
    const fornitoreIds = list.map((f) => f.id)
    const { data: aliases } =
      fornitoreIds.length > 0
        ? await supabase.from('fornitore_emails').select('fornitore_id, email').in('fornitore_id', fornitoreIds)
        : { data: [] as { fornitore_id: string; email: string }[] }
    const aliasByFornitore = new Map<string, Set<string>>()
    for (const a of aliases ?? []) {
      const e = a.email?.trim().toLowerCase()
      if (!e?.includes('@')) continue
      if (!aliasByFornitore.has(a.fornitore_id)) aliasByFornitore.set(a.fornitore_id, new Set())
      aliasByFornitore.get(a.fornitore_id)!.add(e)
    }

    const emailHits = list.filter((f) => {
      const fe = normEmail(f.email ?? undefined)
      if (fe && fe === mitt) return true
      const aset = aliasByFornitore.get(f.id)
      return !!(aset && aset.has(mitt))
    })
    if (emailHits.length === 1) return { id: emailHits[0].id, nome: emailHits[0].nome }
    if (emailHits.length > 1) return null
  }

  if (ocrAddrKey) {
    const addrHits = list.filter((f) => {
      const fk = normalizeAddressKey(f.indirizzo)
      return fk !== null && fk === ocrAddrKey
    })
    if (addrHits.length === 1) return { id: addrHits[0].id, nome: addrHits[0].nome }
    if (addrHits.length > 1) return null
  }

  if (rsTrim) {
    const candidateKeys = ragioneSocialeCandidatesForMatch(rsTrim)
    for (const key of candidateKeys) {
      if (key.length < 3) continue
      const hits = list.filter(
        (f) =>
          canonicalSupplierNameKey(f.nome) === key ||
          (!!f.display_name?.trim() && canonicalSupplierNameKey(f.display_name) === key),
      )
      if (hits.length === 1) return { id: hits[0].id, nome: hits[0].nome }
    }
  }

  return null
}

export type BollaMinimal = { id: string; importo: number | null }

const AMOUNT_EPS = 0.001

/** Greedy subset-sum aligned with PendingMatchesTab autoSuggest. */
export function greedyBollaIdsForTotal(bolle: BollaMinimal[], totalTarget: number): string[] | null {
  if (totalTarget <= 0 || !bolle.length) return null
  const candidates = [...bolle].sort((a, b) => (b.importo ?? 0) - (a.importo ?? 0))
  const found: string[] = []
  let remaining = totalTarget
  for (const b of candidates) {
    const imp = b.importo ?? 0
    if (imp > 0 && imp <= remaining + AMOUNT_EPS) {
      found.push(b.id)
      remaining = parseFloat((remaining - imp).toFixed(2))
      if (remaining <= AMOUNT_EPS) break
    }
  }
  if (found.length === 0 || remaining > AMOUNT_EPS) return null
  return found
}
