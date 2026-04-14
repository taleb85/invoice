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
 * Single fornitore in sede scope when P.IVA, mittente email (or alias), normalized address on anagrafica, or normalized name is unambiguous.
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
  if (!pTrim && !rsTrim && !normEmail(opts.mittente) && !ocrAddrKey) return null

  const sedeId = await resolveEffectiveSedeId(supabase, opts)
  if (!sedeId) return null

  const { data: rows, error } = await supabase
    .from('fornitori')
    .select('id, nome, piva, display_name, email, indirizzo')
    .eq('sede_id', sedeId)

  if (error || !rows?.length) return null

  const list = rows as FornitoreMatchRow[]

  const pDigits = pTrim ? normalizePivaDigits(pTrim) : ''
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

  if (rsTrim && normalizeSupplierNameKey(rsTrim).length >= 3) {
    const key = normalizeSupplierNameKey(rsTrim)
    const hits = list.filter(
      (f) =>
        normalizeSupplierNameKey(f.nome) === key ||
        (!!f.display_name?.trim() && normalizeSupplierNameKey(f.display_name) === key),
    )
    if (hits.length === 1) return { id: hits[0].id, nome: hits[0].nome }
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
