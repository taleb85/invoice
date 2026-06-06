/**
 * Confronto incrociato tra dati fornitore nel corpo email e nel documento allegato.
 *
 * PRIVACY / GDPR:
 * - I dati estratti dal corpo email (ragione sociale, P.IVA, indirizzo, contatti)
 *   vengono elaborati ESCLUSIVAMENTE in memoria per il confronto con i dati OCR.
 * - Nessun dato personale (nominativi referenti, numeri di telefono, indirizzi email
 *   di contatto) viene persistito: l'estrazione avviene solo in memoria RAM del server
 *   durante una singola richiesta HTTP.
 * - I campi estratti non vengono mai loggati, né salvati in database, né trasmessi
 *   a terze parti. Solo il risultato del confronto (confidenza numerica) può influenzare
 *   la selezione del fornitore nell'anagrafica aziendale, che contiene già dati
 *   forniti e autorizzati dall'utente.
 * - Il corpo email, una volta processato, segue le policy esistenti di retention
 *   del sistema (tabella email_scan_log / documenti_da_processare).
 * - Conforme ai principi di minimizzazione dei dati (Art. 5 GDPR) e limitazione
 *   delle finalità (Art. 5 GDPR).
 */

import type { OcrResult } from '@/lib/ocr-invoice'

/**
 * Campi fornitore estratti dal corpo email (regex-based, no AI).
 * Usati per confronto incrociato con i dati OCR del documento allegato.
 */
export type EmailBodySupplierFields = {
  ragione_sociale: string | null
  p_iva: string | null
  indirizzo: string | null
  email_contatto: string | null
  telefono: string | null
  referente: string | null
}

export type CrossCheckMatchLevel = 'exact' | 'strong' | 'partial' | 'none'

export type FieldComparisonResult = {
  field: string
  emailValue: string | null
  ocrValue: string | null
  match: CrossCheckMatchLevel
}

export type CrossCheckResult = {
  confirmed: boolean
  confidence: number
  comparisons: FieldComparisonResult[]
  candidateNameFromEmail: string | null
}

export function extractSupplierFieldsFromEmailBody(text: string | null | undefined): EmailBodySupplierFields {
  if (!text?.trim()) return { ragione_sociale: null, p_iva: null, indirizzo: null, email_contatto: null, telefono: null, referente: null }

  const body = text.trim()

  return {
    ragione_sociale: extractRagioneSociale(body),
    p_iva: extractPartitaIva(body),
    indirizzo: extractIndirizzo(body),
    email_contatto: extractEmailContatto(body),
    telefono: extractTelefono(body),
    referente: extractReferente(body),
  }
}

function extractPartitaIva(text: string): string | null {
  const patterns = [
    /p\.?\s*iva[:\s]*([0-9]{11})/i,
    /p\.?\s*iva[:\s]*it\s*([0-9]{11})/i,
    /partita\s+iva[:\s]*it?\s*([0-9]{11})/i,
    /vat[:\s]*(?:no\.?|number|#)?[:\s]*(?:[a-z]{2})?([0-9]{9,14})/i,
    /c\.?f\.?[:\s]*([0-9]{11})/i,
    /codice\s+fiscale[:\s]*([0-9]{11})/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m?.[1]) {
      const digits = m[1].replace(/\D/g, '')
      if (digits.length >= 9) return digits
    }
  }
  return null
}

const NAME_CHARS = "[A-Za-zÀ-ÿ0-9 '&.,-]"

function extractRagioneSociale(text: string): string | null {
  const patterns = [
    new RegExp(`(?:ditta|azienda|societa|società|fornitore|impresa)[:\\s]*["«]?(${NAME_CHARS}{4,60})["»]?`, 'i'),
    new RegExp(`(?:company|supplier|vendor|firm)[:\\s]*["«]?(${NAME_CHARS}{4,60})["»]?`, 'i'),
    new RegExp(`ragione\\s+sociale[:\\s]*["«]?(${NAME_CHARS}{4,60})["»]?`, 'i'),
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m?.[1]) {
      const name = m[1].replace(/["«»]+/g, '').trim()
      if (name.length >= 4) return name.split(/\n/)[0].trim()
    }
  }
  return null
}

const ADDR_CHARS = "[A-Za-zÀ-ÿ0-9 .,'°-]"

function extractIndirizzo(text: string): string | null {
  const patterns = [
    new RegExp(`indirizzo[:\\s]*["«]?(${ADDR_CHARS}{10,80})["»]?`, 'i'),
    new RegExp(`sede[:\\s]*["«]?(${ADDR_CHARS}{10,80})["»]?`, 'i'),
    new RegExp(`address[:\\s]*["«]?(${ADDR_CHARS}{10,80})["»]?`, 'i'),
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m?.[1]) {
      const addr = m[1].replace(/["«»]+/g, '').trim()
      if (addr.length >= 8) return addr.split(/\n/)[0].trim()
    }
  }
  return null
}

function extractEmailContatto(text: string): string | null {
  const m = text.match(/(?:email|e-mail|mail|@)[:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
  if (m?.[1]) {
    const email = m[1].toLowerCase().trim()
    if (email.length >= 5) return email
  }
  return null
}

function extractTelefono(text: string): string | null {
  const m = text.match(/(?:tel|phone|telefono|cell|mobile)[:\s.]*(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/i)
  if (m) {
    const phone = m[0].replace(/^(?:tel|phone|telefono|cell|mobile)[:\s.]+/i, '').trim()
    const digits = phone.replace(/\D/g, '')
    if (digits.length >= 6) return digits
  }
  return null
}

const REF_CHARS = "[A-Za-zÀ-ÿ '-]"

function extractReferente(text: string): string | null {
  const patterns = [
    new RegExp(`(?:referente|contatto)[:\\s]*["«]?(${REF_CHARS}{4,40})["»]?`, 'i'),
    new RegExp(`c\\.?a\\.?\\s*["«]?(${REF_CHARS}{4,40})["»]?`, 'i'),
    new RegExp(`att\\.?\\s*["«]?(${REF_CHARS}{4,40})["»]?`, 'i'),
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m?.[1]) {
      const name = m[1].replace(/["«»]+/g, '').trim()
      if (name.length >= 4) return name.split(/\n/)[0].trim()
    }
  }
  return null
}

export function tokenOverlapRatio(a: string | null | undefined, b: string | null | undefined): number {
  if (!a?.trim() || !b?.trim()) return 0
  const tokensA = new Set(
    a.toUpperCase()
      .split(/[\s,.\-/_&]+/g)
      .map(t => t.replace(/[^A-Z0-9À-ÿ]/g, ''))
      .filter(t => t.length >= 3)
  )
  const tokensB = new Set(
    b.toUpperCase()
      .split(/[\s,.\-/_&]+/g)
      .map(t => t.replace(/[^A-Z0-9À-ÿ]/g, ''))
      .filter(t => t.length >= 3)
  )
  if (tokensA.size === 0 || tokensB.size === 0) return 0
  let intersection = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++
  }
  const union = new Set([...tokensA, ...tokensB])
  if (union.size === 0) return 0
  return intersection / union.size
}

const STOP_WORDS_UC = new Set([
  'SPA', 'S.P.A.', 'SRL', 'S.R.L.', 'SS', 'S.S.', 'SNC', 'S.N.C.', 'SAS', 'S.A.S.', 'SRLS',
  'LTD', 'LIMITED', 'LLC', 'INC', 'CORP', 'GMBH', 'AG', 'KG', 'E.K.',
  'DI', 'DEL', 'DELLA', 'DEI', 'IL', 'LA', 'LO', 'GLI', 'LE', 'UN', 'UNA',
  'THE', 'A', 'AN', 'OF', 'FOR', 'AND',
])

export function normalizeRagioneSocialeForComparison(name: string | null | undefined): string {
  if (!name?.trim()) return ''
  let n = name.toUpperCase().trim()
  n = n.replace(/["«»'']/g, '')
  n = n.replace(/[^A-Z0-9À-ÿ\s]/g, ' ')
  n = n.replace(/\s+/g, ' ').trim()
  const tokens = n.split(/\s+/).filter(t => t.length >= 2 && !STOP_WORDS_UC.has(t))
  return tokens.join(' ')
}

export function compareRagioneSociale(
  a: string | null | undefined,
  b: string | null | undefined,
): CrossCheckMatchLevel {
  const na = normalizeRagioneSocialeForComparison(a)
  const nb = normalizeRagioneSocialeForComparison(b)
  if (!na || !nb) return 'none'

  if (na === nb) return 'exact'

  const overlap = tokenOverlapRatio(a, b)
  if (overlap >= 0.8) return 'exact'
  if (overlap >= 0.5) return 'strong'
  if (overlap >= 0.25) return 'partial'

  const tokensA = na.split(/\s+/)
  const tokensB = nb.split(/\s+/)
  for (const ta of tokensA) {
    if (ta.length >= 4 && tokensB.some(tb => tb.includes(ta) || ta.includes(tb))) {
      return 'partial'
    }
  }

  return 'none'
}

/** True se il nome in anagrafica è compatibile con la ragione sociale OCR. */
export function fornitoreNomeMatchesOcr(
  fornitoreNome: string | null | undefined,
  ocrRagioneSociale: string | null | undefined,
): boolean {
  const level = compareRagioneSociale(fornitoreNome, ocrRagioneSociale)
  return level === 'exact' || level === 'strong' || level === 'partial'
}

export function comparePartitaIva(
  a: string | null | undefined,
  b: string | null | undefined,
): CrossCheckMatchLevel {
  const da = String(a ?? '').replace(/\D/g, '')
  const db = String(b ?? '').replace(/\D/g, '')
  if (!da || !db) return 'none'
  if (da.length < 9 || db.length < 9) return 'none'
  if (da === db) return 'exact'
  if (da.slice(-9) === db.slice(-9)) return 'exact'
  if (da.slice(-7) === db.slice(-7)) return 'strong'
  if (da.slice(-5) === db.slice(-5)) return 'partial'
  return 'none'
}

export function crossCheckSupplierFields(
  emailFields: EmailBodySupplierFields,
  ocr: OcrResult,
): CrossCheckResult {
  const comparisons: FieldComparisonResult[] = []

  const pIvaMatch = comparePartitaIva(emailFields.p_iva, ocr.p_iva ?? ocr.piva)
  comparisons.push({ field: 'p_iva', emailValue: emailFields.p_iva, ocrValue: ocr.p_iva ?? ocr.piva, match: pIvaMatch })

  const nameMatch = compareRagioneSociale(emailFields.ragione_sociale, ocr.ragione_sociale)
  comparisons.push({ field: 'ragione_sociale', emailValue: emailFields.ragione_sociale, ocrValue: ocr.ragione_sociale, match: nameMatch })

  const addrMatch = compareRagioneSociale(emailFields.indirizzo, ocr.indirizzo)
  comparisons.push({ field: 'indirizzo', emailValue: emailFields.indirizzo, ocrValue: ocr.indirizzo, match: addrMatch })

  const scores: Record<CrossCheckMatchLevel, number> = { exact: 40, strong: 25, partial: 10, none: 0 }
  let totalScore = 0
  let maxScore = 0
  for (const c of comparisons) {
    if (c.emailValue && c.ocrValue) {
      totalScore += scores[c.match]
      maxScore += 40
    } else if (c.emailValue || c.ocrValue) {
      maxScore += 10
    }
  }

  const confirmed = pIvaMatch === 'exact' || (nameMatch !== 'none' && totalScore >= 30)
  const confidence = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

  return {
    confirmed,
    confidence,
    comparisons,
    candidateNameFromEmail: emailFields.ragione_sociale,
  }
}
