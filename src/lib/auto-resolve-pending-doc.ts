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
 * OCR concatena numero fattura + "from Supplier — sede - data"; segmenti e strip «INV … from»;
 * NBSP/trattini tipografici normalizzati perché `\s-\s` nello split funzioni.
 */
function normalizeOcrRagioneSocialeLine(s: string): string {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * OCR spesso più corto dell’anagrafica ("ital cutlery" vs "ital cutlery ltd") o più lungo
 * con suffisso; match esatto è troppo fragile.
 */
function supplierNameKeysCompatible(ocrKey: string, dbKey: string): boolean {
  if (ocrKey.length < 3 || dbKey.length < 3) return false
  if (ocrKey === dbKey) return true
  if (dbKey.startsWith(`${ocrKey} `)) return true
  if (ocrKey.startsWith(`${dbKey} `)) return true
  return false
}

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

  const work = normalizeOcrRagioneSocialeLine(rsTrim)
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
      const hits = list.filter((f) => {
        const nk = canonicalSupplierNameKey(f.nome)
        const dk = f.display_name?.trim() ? canonicalSupplierNameKey(f.display_name) : ''
        const nameHit = supplierNameKeysCompatible(key, nk)
        const displayHit = dk ? supplierNameKeysCompatible(key, dk) : false
        return nameHit || displayHit
      })
      if (hits.length === 1) return { id: hits[0].id, nome: hits[0].nome }
      if (hits.length > 1) continue
    }
  }

  return null
}

export type BollaMinimal = { id: string; importo: number | null }

const AMOUNT_EPS = 0.001

/** Pending invoice ↔ bolle auto-match: invoice doc date vs bolla delivery date (± days). */
export const MATCH_BOLLA_DATE_WINDOW_DAYS = 30

/** Max relative gap between invoice OCR total and sum of matched bolle importi (invoice as base). */
export const MATCH_BOLLA_AMOUNT_REL_TOLERANCE = 0.05

export type BollaForInvoiceMatch = BollaMinimal & { data?: string | null }

function utcDayNumber(isoDateLike: string): number | null {
  const base = isoDateLike.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return null
  const t = Date.parse(`${base}T12:00:00.000Z`)
  return Number.isFinite(t) ? Math.floor(t / 86400000) : null
}

/**
 * Invoice doc date (`YYYY-MM-DD`) vs bolla row date: bolle più vecchie di 30 giorni rispetto alla data
 * documento sono escluse dal pool di auto-match quando la data fattura è nota.
 * Se manca la data sulla fattura o sulla bolla → non si filtra sulla data (evita blocchi OCR incompleti).
 */
export function bollaWithinInvoiceDateWindow(
  invoiceDocIso: string | null | undefined,
  bollaDataIso: string | null | undefined,
  windowDays: number,
): boolean {
  if (!invoiceDocIso?.trim()) return true
  const inv = utcDayNumber(invoiceDocIso)
  const bol = bollaDataIso?.trim() ? utcDayNumber(bollaDataIso) : null
  if (inv == null || bol == null) return true
  return Math.abs(bol - inv) <= windowDays
}

const MAX_BRUTE_FORCE_BOLLE = 15

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

function sumImportiRounded(importi: number[]): number {
  return Math.round(importi.reduce((a, x) => a + x, 0) * 100) / 100
}

/** Per ricerca combinazioni: tieni prima le bolle più vicine in data alla fattura, poi più grandi importi. */
function prioritizeBolleForFuzzySearch(pool: BollaForInvoiceMatch[], invoiceDocIso: string | null): BollaForInvoiceMatch[] {
  if (pool.length <= MAX_BRUTE_FORCE_BOLLE) return pool
  const invDay = invoiceDocIso?.trim() ? utcDayNumber(invoiceDocIso) : null
  const scored = pool.map((b) => ({
    b,
    dd:
      invDay != null && b.data?.trim()
        ? (() => {
            const bd = utcDayNumber(b.data)
            return bd == null ? 99999 : Math.abs(bd - invDay)
          })()
        : 99998,
    imp: b.importo ?? 0,
  }))
  scored.sort((x, y) => (x.dd !== y.dd ? x.dd - y.dd : y.imp - x.imp))
  return scored.slice(0, MAX_BRUTE_FORCE_BOLLE).map((x) => x.b)
}

/**
 * Riconciliazione fattura in coda vs bolle aperte: stesso fornitore gestito dal chiamante;
 * dopo filtro date (30 giorni se data doc nota) prova prima somma greedy esatta poi sottoinsieme univoco entro tol. 5% sull’importo fattura.
 */
export function resolveBolleMatchForPendingInvoice(
  bolle: BollaForInvoiceMatch[],
  totalTarget: number,
  invoiceDocIso: string | null,
  opts?: { windowDays?: number; amountRelTol?: number },
): string[] | null {
  const windowDays = opts?.windowDays ?? MATCH_BOLLA_DATE_WINDOW_DAYS
  const amountRelTol = opts?.amountRelTol ?? MATCH_BOLLA_AMOUNT_REL_TOLERANCE

  if (totalTarget <= 0 || !bolle.length) return null
  const withAmount = bolle.filter((b) => b.importo != null && b.importo > 0)
  if (!withAmount.length) return null

  const pool = withAmount.filter((b) =>
    bollaWithinInvoiceDateWindow(invoiceDocIso ?? null, b.data ?? null, windowDays),
  )
  if (!pool.length) return null

  const minimal: BollaMinimal[] = pool.map(({ id, importo }) => ({ id, importo }))
  const exactIds = greedyBollaIdsForTotal(minimal, totalTarget)
  if (exactIds?.length) return exactIds

  const atol = Math.max(totalTarget * amountRelTol, 0.009)
  const searchPool = prioritizeBolleForFuzzySearch(pool, invoiceDocIso ?? null)

  /** Sottoinsieme non vuoto univoco tale che |somma(importi) − totalTarget| ≤ atol. */
  const fuzzyMatches: string[][] = []
  const n = searchPool.length
  for (let mask = 1; mask < 1 << n; mask++) {
    const ids: string[] = []
    const sums: number[] = []
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        ids.push(searchPool[i].id)
        sums.push(searchPool[i].importo!)
      }
    }
    const sum = sumImportiRounded(sums)
    if (Math.abs(sum - totalTarget) <= atol) {
      fuzzyMatches.push(ids)
    }
  }

  const seenKeys = new Set<string>()
  const distinct: string[][] = []
  for (const ids of fuzzyMatches) {
    const key = [...ids].sort().join('|')
    if (seenKeys.has(key)) continue
    seenKeys.add(key)
    distinct.push(ids)
  }
  if (distinct.length !== 1) return null
  return distinct[0]
}
