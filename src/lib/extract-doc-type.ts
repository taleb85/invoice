import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'

/**
 * Converts an OCR `tipo_documento` value (raw or normalised) to a human-readable label.
 * Returns null for types that are implicit from context (e.g. bolla_ddt in the Bolle tab).
 */
/**
 * Converts a normalised OCR `tipo_documento` to a display label.
 * Returns null for the "expected" default types (`fattura`, `bolla_ddt`) so callers
 * can fall through to context-specific fallbacks (e.g. "Invoice", "Delivery Note").
 * Only returns a label when the type is meaningfully different from the default context.
 */
export function tipoDocumentoToLabel(rawTipo: unknown): string | null {
  const t = normalizeTipoDocumento(rawTipo)
  switch (t) {
    case 'nota_credito': return 'Credit Note'
    case 'ordine': return 'Order Confirmation'
    case 'estratto_conto': return 'Statement'
    case 'comunicazione': return null
    // 'fattura' and 'bolla_ddt' are default types — let the rendering fallback handle them
    default: return null
  }
}

/**
 * Strict variant of {@link tipoDocumentoToLabel}: returns a human-readable label for
 * every recognised OCR `tipo_documento`, including the default categories
 * (`fattura`, `bolla_ddt`). Returns null only when the OCR has no usable
 * classification at all.
 *
 * Use this where the goal is to make the user understand *which* document type
 * the OCR actually detected (e.g. on the Bolle list, to flag an invoice
 * mistakenly saved under delivery notes). Use {@link tipoDocumentoToLabel}
 * when you want to skip labelling rows whose type matches the surrounding
 * context (e.g. labelling a `fattura` as "Invoice" inside the Fatture tab is
 * redundant).
 */
export function tipoDocumentoToLabelStrict(rawTipo: unknown): string | null {
  const t = normalizeTipoDocumento(rawTipo)
  switch (t) {
    case 'fattura': return 'Invoice'
    case 'nota_credito': return 'Credit Note'
    case 'bolla_ddt': return 'Delivery Note'
    case 'ordine': return 'Order Confirmation'
    case 'estratto_conto': return 'Statement'
    case 'comunicazione': return null
    default: return null
  }
}

/**
 * Extracts a human-readable document-type label from a free-text string
 * (title, filename, reference number, storage URL path, etc.).
 * Matches common keywords in English, Italian, French, German and Spanish.
 * Returns null when the type cannot be inferred.
 */
export function extractDocTypeLabel(
  ...sources: Array<string | null | undefined>
): string | null {
  const text = sources
    .map((s) => {
      if (!s) return ''
      // For storage URLs extract just the filename segment
      const seg = s.includes('/') ? (s.split('/').pop() ?? s) : s
      // Strip query-string (e.g. ?token=...) and extension
      return seg.split('?')[0]!.replace(/\.[a-z0-9]+$/i, '')
    })
    .join(' ')
    .toLowerCase()

  if (!text.trim()) return null

  if (/invoice|fattura|facture|rechnung|factura/.test(text)) return 'Invoice'
  if (/credit.note|nota.credito|note.de.crédit|gutschrift|nota.de.crédito/.test(text))
    return 'Credit Note'
  if (/delivery.note|ddt|bon.de.livraison|lieferschein|albar[aá]n/.test(text))
    return 'Delivery Note'
  if (
    /order.confirm|conferma.ordin|confirmation.de.commande|auftragsbestätigung|confirmaci/.test(text)
  )
    return 'Order Confirmation'
  if (/purchase.order|ordine.acquisto|bon.de.commande|bestellung|orden.de.compra/.test(text))
    return 'Purchase Order'
  if (/statement|estratto.conto|relevé.de.compte|kontoauszug|extracto/.test(text))
    return 'Statement'
  if (/receipt|ricevuta|reçu|quittung|recibo/.test(text)) return 'Receipt'
  if (/proforma|pro.forma/.test(text)) return 'Pro-forma Invoice'

  return null
}

/**
 * Splits a title into a short reference code (primary display) and a type label (secondary).
 * e.g. "Enotria Order Confirmation: SO1965613" → { primary: "SO1965613", secondary: "Order Confirmation" }
 */
export function splitDocTitleForDisplay(
  titolo: string | null,
  fileName: string | null,
): { primary: string; secondary: string | null } {
  const text = titolo?.trim() ?? ''
  const docType = extractDocTypeLabel(text)

  if (text && docType) {
    const refMatch = text.match(/\b([A-Z]{1,6}[-/]?\d{3,}|\d{4,})\b/gi)
    const ref = refMatch ? refMatch[refMatch.length - 1] : null
    if (ref) return { primary: ref, secondary: docType }
  }

  const secondaryFromFile = extractDocTypeLabel(fileName)
  return {
    primary: text || fileName || '—',
    secondary: secondaryFromFile,
  }
}

const EMAIL_SUBJECT_NOISE = /\*{0,2}\s*do\s+not\s+reply(?:\s*email)?\s*\*{0,2}/gi
const DUPLICATE_DOC_TYPE_IN_TITLE = /(\b(?:order confirmation|conferma ordine)\b)(?:\s+\1)+/gi

/** Rimuove boilerplate tipico dell’oggetto mail Rekki / IMAP. */
export function cleanConfermaOrdineTitleText(raw: string): string {
  return raw
    .replace(EMAIL_SUBJECT_NOISE, ' ')
    .replace(DUPLICATE_DOC_TYPE_IN_TITLE, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function isLikelyCalendarYearToken(token: string): boolean {
  if (!/^\d{4}$/.test(token)) return false
  const y = Number(token)
  return y >= 2015 && y <= 2035
}

/** Segmento file senza path/query ed estensione. */
function fileNameStem(fileName: string): string {
  const seg = fileName.includes('/') ? (fileName.split('/').pop() ?? fileName) : fileName
  return seg.split('?')[0]!.replace(/\.[a-z0-9]+$/i, '')
}

/**
 * Numero ordine nel nome allegato Rekki / fornitore (es. `Sales Order Confirmation-543585.pdf`).
 */
export function extractOrderReferenceFromFileName(
  fileName: string | null | undefined,
): string | null {
  if (!fileName?.trim()) return null
  const stem = fileNameStem(fileName)

  const salesOrderTail = stem.match(
    /(?:sales\s+)?order\s+confirmation[-_\s#:]+([A-Z]{0,4}[-]?[0-9]{3,}[A-Z0-9/-]*)\s*$/i,
  )
  if (salesOrderTail?.[1]) return salesOrderTail[1].replace(/^[-\s]+/, '').trim()

  const confirmTail = stem.match(/confirmation[-_\s#:]+([A-Z]{0,4}[-]?[0-9]{3,})\s*$/i)
  if (confirmTail?.[1]) return confirmTail[1].replace(/^[-\s]+/, '').trim()

  return null
}

/** ID numerico lungo tipico dell’oggetto mail Rekki (non numero ordine commerciale). */
function looksLikeRekkiEmailMessageId(value: string): boolean {
  return /^\d{7,9}$/.test(value.trim())
}

/**
 * Estrae il riferimento ordine commerciale da titolo, oggetto mail o nome file.
 * Preferisce codici alfanumerici (SO1965613) rispetto a numeri generici brevi.
 */
export function extractOrderReferenceFromText(...sources: Array<string | null | undefined>): string | null {
  const candidates: string[] = []

  for (const src of sources) {
    if (!src?.trim()) continue
    const text = cleanConfermaOrdineTitleText(src)
    if (!text) continue

    const colonTail = text.match(/[:#]\s*([A-Z]{0,6}[-/]?\d{3,}[A-Z0-9/-]*)\s*$/i)
    if (colonTail?.[1]) {
      candidates.push(colonTail[1].trim())
    }

    const prefixed = text.matchAll(/\b(SO|PO|ORD|OC|P\.O\.)[-#\s]?(\d{3,})\b/gi)
    for (const m of prefixed) {
      const prefix = m[1]!.replace(/\./g, '').toUpperCase()
      candidates.push(`${prefix}${m[2]}`)
    }

    const alphaNum = text.matchAll(/\b([A-Z]{2,6}[-/]\d{4,})\b/g)
    for (const m of alphaNum) candidates.push(m[1]!)

    const longDigits = text.matchAll(/\b(\d{6,})\b/g)
    for (const m of longDigits) candidates.push(m[1]!)

    const mediumDigits = text.matchAll(/\b(\d{4,5})\b/g)
    for (const m of mediumDigits) {
      if (!isLikelyCalendarYearToken(m[1]!)) candidates.push(m[1]!)
    }
  }

  if (candidates.length === 0) return null

  const unique = [...new Set(candidates.map((c) => c.toUpperCase()))]
  unique.sort((a, b) => {
    const aPrefixed = /^[A-Z]{2,}/.test(a) ? 1 : 0
    const bPrefixed = /^[A-Z]{2,}/.test(b) ? 1 : 0
    if (aPrefixed !== bPrefixed) return bPrefixed - aPrefixed
    return b.length - a.length
  })
  return unique[0] ?? null
}

function confermaTitleLooksLikeNoise(primary: string): boolean {
  const t = primary.toLowerCase()
  return (
    primary.length > 56 ||
    /do not reply/.test(t) ||
    /\border confirmation\b.*\border confirmation\b/.test(t)
  )
}

function titleCaseDocumentTypePhrase(raw: string): string {
  return raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
}

/** Normalizza l’intestazione tipo documento (es. «Sales Order Confirmation» → «Sales Order»). */
export function normalizeConfermaOrdineTipoPhrase(phrase: string): string {
  const p = phrase.trim()
  if (/^sales\s+order(\s+confirmation)?$/i.test(p)) return 'Sales Order'
  if (/^purchase\s+order(\s+confirmation)?$/i.test(p)) return 'Purchase Order'
  if (/^work\s+order(\s+confirmation)?$/i.test(p)) return 'Work Order'
  if (/\s+confirmation$/i.test(p) && !/^order\s+confirmation$/i.test(p)) {
    return p.replace(/\s+confirmation$/i, '').trim()
  }
  return p
}

/**
 * Tipo documento dall’intestazione nel nome file PDF (prima del suffisso numerico).
 * Es. `Sales Order Confirmation-543585.pdf` → `Sales Order`.
 */
export function extractConfermaOrdineTipoFromFileName(
  fileName: string | null | undefined,
): string | null {
  if (!fileName?.trim()) return null
  const stem = fileNameStem(fileName)
  const withoutNum = stem.replace(/[-_\s#:]+\d{3,}[A-Z0-9/-]*\s*$/i, '').trim()
  if (!withoutNum || !/[a-z]/i.test(withoutNum)) return null
  return normalizeConfermaOrdineTipoPhrase(titleCaseDocumentTypePhrase(withoutNum))
}

/** Etichetta tipo per tab Conferme ordine (PDF / oggetto mail / fallback generico). */
export function extractConfermaOrdineTipoLabel(input: {
  fileName?: string | null
  titolo?: string | null
  oggettoMail?: string | null
  /** Eventuale etichetta OCR salvata in metadata (futuro / backfill). */
  tipoDocumentoLabel?: string | null
}): string {
  const fromFile = extractConfermaOrdineTipoFromFileName(input.fileName)
  if (fromFile) return fromFile

  if (input.tipoDocumentoLabel?.trim()) {
    return normalizeConfermaOrdineTipoPhrase(input.tipoDocumentoLabel.trim())
  }

  const cleanedOggetto = cleanConfermaOrdineTitleText(input.oggettoMail ?? '')
  const tipoInOggetto = cleanedOggetto.match(
    /\b(sales\s+order|purchase\s+order|work\s+order|order\s+confirmation|conferma\s+ordine)(?:\s+confirmation)?\b/i,
  )
  if (tipoInOggetto?.[1]) {
    return normalizeConfermaOrdineTipoPhrase(titleCaseDocumentTypePhrase(tipoInOggetto[1]))
  }

  return extractDocTypeLabel(input.titolo, input.fileName, input.oggettoMail) ?? 'Order Confirmation'
}

/** Miglior numero ordine commerciale per archiviazione / tabella conferme. */
export function resolveConfermaOrdineNumero(input: {
  titolo?: string | null
  fileName?: string | null
  numeroOrdine?: string | null
  numeroFatturaMetadata?: string | null
  oggettoMail?: string | null
}): string | null {
  const columnRef = input.numeroOrdine?.trim()
  if (columnRef) return columnRef

  const fileRef = extractOrderReferenceFromFileName(input.fileName)
  if (fileRef) return fileRef

  const textRef = extractOrderReferenceFromText(input.oggettoMail, input.titolo)
  if (textRef && /[A-Z]{2,}/i.test(textRef)) return textRef

  const metaRef = input.numeroFatturaMetadata?.trim() || null
  const titoloRef = input.titolo?.trim() || null
  const metaTitoloSameRekkiId =
    !!metaRef &&
    !!titoloRef &&
    metaRef === titoloRef &&
    looksLikeRekkiEmailMessageId(metaRef)

  if (metaRef && !metaTitoloSameRekkiId) return metaRef
  if (textRef && !(metaTitoloSameRekkiId && textRef === metaRef)) return textRef

  const cleanedTitolo = cleanConfermaOrdineTitleText(titoloRef ?? '')
  if (cleanedTitolo && !confermaTitleLooksLikeNoise(cleanedTitolo) && !looksLikeRekkiEmailMessageId(cleanedTitolo)) {
    return cleanedTitolo
  }

  return titoloRef || metaRef || null
}

/** Etichetta tabella Conferme ordine: numero ordine in evidenza, tipo documento in seconda riga. */
export function confermaOrdineDisplayLabel(input: {
  titolo?: string | null
  fileName?: string | null
  numeroOrdine?: string | null
  numeroFatturaMetadata?: string | null
  oggettoMail?: string | null
  tipoDocumentoLabel?: string | null
}): { primary: string; secondary: string | null } {
  const docType = extractConfermaOrdineTipoLabel(input)

  const primary = resolveConfermaOrdineNumero(input)
  if (primary) {
    return { primary, secondary: docType }
  }

  const fallback =
    cleanConfermaOrdineTitleText(input.titolo ?? '') ||
    input.oggettoMail?.trim() ||
    input.fileName?.trim() ||
    '—'
  return {
    primary: fallback,
    secondary: docType,
  }
}
