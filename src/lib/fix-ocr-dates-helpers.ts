import { scanContextSuggestsBolla, scanContextSuggestsFattura } from '@/lib/document-bozza-routing'
import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'

/**
 * Nome file dall’URL (per euristiche fattura vs DDT in assenza di contesto email).
 */
export function fileNameFromStorageUrl(url: string): string {
  if (!url?.trim()) return ''
  try {
    const u = new URL(url)
    return decodeURIComponent(u.pathname.split('/').pop() || '') || ''
  } catch {
    return decodeURIComponent(url.split('/').pop()?.split('?')[0] || '') || ''
  }
}

/**
 * Riferimento documento con etichetta da DDT / trasporto (da non trattare come fattura fiscale).
 */
export function numeroReferenceLooksLikeDdt(num: string | null | undefined): boolean {
  if (!num?.trim()) return false
  const n = num.trim()
  return (
    /\b(ddt|d\.?\s*o\.?\s*\.?\s*t\.?|bolla|despatch|despach|despacho|lieferschein|albar[aá]n|dn\s*no|n[°°]\s*ddt|documento\s*di\s*trasporto|bon\s*de\s*livraison)\b/i.test(
      n,
    ) && !/\b(fattura|invoice|rechnung|facture|factura|nota[\s-]*credito|vat|tax|credit[\s-]*note)\b/i.test(n)
  )
}

/**
 * Normalizza e valida un numero documento estratto da OCR (numero bolla, fattura, DDT).
 *
 * Problema comune: l'AI scambia cifre simili (8↔1, 4↔1, 6↔4, 5↔4) durante l'estrazione.
 * Questa funzione applica:
 * 1. Strip di prefissi testuali (DDT, N., No., DN, etc.)
 * 2. Rimozione spazi e caratteri non alfanumerici
 * 3. Validazione lunghezza minima
 * 4. Verifica consistenza (solo cifre per numeri puri)
 */
export function normalizeNumeroBolla(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null

  let n = raw.trim()

  // Rimuovi prefissi testuali comuni (case-insensitive)
  n = n.replace(/^(?:fattura\s+|ft\s+|invoice\s+|ddt|bolla|n\.?\s*|no\.?\s*|num\.?\s*|numero\s*|documento\s+|doc\.?\s*|dn\.?\s*|d\.n\.\s*|order\s+|ordine\s+)[:\s.]*/i, '')

  // Rimuovi spazi multipli e caratteri di separazione estranei a inizio/fine
  n = n.replace(/\s+/g, ' ').trim()
  n = n.replace(/^[:\s.\-_,;]+|[:\s.\-_,;]+$/g, '').trim()

  // Se dopo la pulizia rimane vuoto, ritorna null
  if (!n) return null

  // Per numeri puramente numerici (solo cifre): validazione lunghezza
  if (/^\d+$/.test(n)) {
    if (n.length < 2) return null
    if (n.length > 30) return n.slice(0, 30)
    return n
  }

  // Per codici alfanumerici (es. "DDT-2024-00123" o "FT/2026/00123"): mantieni ma normalizza
  if (/^[a-zA-Z0-9\-\/:._]+$/.test(n)) {
    return n
  }

  // Se contiene caratteri non validi, tentiamo di estrarre solo la parte numerica
  const digitsOnly = n.replace(/\D/g, '')
  if (digitsOnly.length >= 3) {
    return digitsOnly
  }

  // Tentativo: estrai alfanumerico + separatori comuni
  const alnum = n.replace(/[^a-zA-Z0-9\-/._]/g, '').replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
  if (alnum.length >= 2) return alnum

  return null
}

/**
 * Dopo OCR su una bolla: decidere se spostare in `fatture` oltre a `tipo_documento === 'fattura'`.
 * Per **batch** (senza bolla forzata) resta solo la classificazione esplicita.
 * Per **Rianalizza** (bollaId forzata + allow_tipo_migrate): Gemini spesso restituisce `bolla` anche per
 * pagine fattura, o `null` senza motivo — usiamo filename, numero+importo e assenza di segnali DDT.
 * `altro` da OCR (ordine, dubbio, “tax invoice” non normalizzato) spesso **blocca** se trattato
 * come categoria fissa: in rianalizza su riga bolla, con numero/importo (da OCR o da tabella) si
 * applica la stessa logica di `bolla` / `null` dopo i controlli DDT e nome file.
 */
export function shouldMigrateBollaRowToFattura(params: {
  ocr: {
    /**
     * Accetta sia i nuovi valori canonici (bolla_ddt, comunicazione, …) sia i legacy
     * (bolla, comunicazione_cliente, altro, curriculum) presenti in DB pre-migrazione.
     */
    tipo_documento: string | null
    numero_fattura: string | null
    totale_iva_inclusa: number | null
  }
  fileUrl: string
  bollaIdForce: boolean
  allowTipoMigrate: boolean
  /** Riga bolla attuale: se l’OCR non estrae nulla, si può usare per le euristiche bolla→fattura. */
  existingNumeroBolla?: string | null
  existingImporto?: number | null
}): boolean {
  const { ocr, fileUrl, bollaIdForce, allowTipoMigrate, existingNumeroBolla, existingImporto } = params
  // Normalizza sia valori nuovi (bolla_ddt) sia legacy (bolla, altro, curriculum…)
  const t = normalizeTipoDocumento(ocr.tipo_documento)
  if (!allowTipoMigrate) return t === 'fattura'
  if (t === 'fattura') return true
  // comunicazione include ex-curriculum e ex-comunicazione_cliente: non migrare
  if (t === 'comunicazione') return false
  if (!bollaIdForce) return false

  const fname = fileNameFromStorageUrl(fileUrl)
  const ctxFat = scanContextSuggestsFattura('', fname)
  const ctxBol = scanContextSuggestsBolla('', fname)
  const ocrNumOk = Boolean(ocr.numero_fattura?.trim())
  const ocrImpOk = ocr.totale_iva_inclusa != null && !Number.isNaN(Number(ocr.totale_iva_inclusa))
  const importoStr = existingImporto == null ? '' : String(existingImporto).trim()
  const importoN = importoStr === '' ? NaN : Number(importoStr)
  const rowNumOk = (existingNumeroBolla?.trim()?.length ?? 0) > 0
  const rowImpOk = importoStr !== '' && !Number.isNaN(importoN)
  /**
   * Coppia numero+totale per la migrazione: accetta incroci OCR↔riga (es. importo solo da OCR,
   * numero solo su bolla) così la Rianalizza funziona anche quando l’OCR è parziale.
   */
  const hasNumeroImporto =
    (ocrNumOk && ocrImpOk) || (rowNumOk && rowImpOk) || (ocrNumOk && rowImpOk) || (rowNumOk && ocrImpOk)

  const numForDdt = ocr.numero_fattura?.trim() ? ocr.numero_fattura : existingNumeroBolla
  if (numeroReferenceLooksLikeDdt(numForDdt)) return false

  /**
   * Da qui `bollaIdForce` è sempre true (altrimenti riga sopra: niente bolla→fattura euristica).
   * Nome file storage o email non deve **bloccare** (prima: `ctxBol && !ctxFat` = false) — i path
   * `quick-scan/…/t-id.jpg` o stringhe casuali danno falsi positivi. Resta un solo segnale positivo
   * forte: nome file chiaramente fattura.
   */
  if (ctxFat && !ctxBol) return true

  // bolla_ddt (ex-bolla) o null con dati: heuristica migrazione attiva
  if (t === 'bolla_ddt' || t === null) {
    if (!hasNumeroImporto) return false
    return true
  }
  return false
}

/**
 * Heuristics to find bolle / fatture whose stored `data` (YYYY-MM-DD) is likely wrong
 * and should be re-scanned with OCR.
 */
export function isSuspiciousDocumentDate(data: string | null | undefined): boolean {
  if (data == null || data === '') return false
  const t = String(data).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return true
  const y = parseInt(t.slice(0, 4), 10)
  const m = parseInt(t.slice(5, 7), 10)
  const d = parseInt(t.slice(8, 10), 10)
  if (m < 1 || m > 12) return true
  if (d < 1 || d > 31) return true
  if (y < 1990) return true
  /** In linea con la query in `/api/admin/fix-ocr-dates` (oltre 2035-12-31) */
  if (t > '2035-12-31') return true
  const today = new Date().toISOString().slice(0, 10)
  if (t > today) return true
  return false
}

/**
 * Coda fornitore / singolo: include documenti oltre alle date sospette, quando mancano
 * numero o importo (allegato presente) — altrimenti "Controllo OCR" non tocca mai bolle
 * con data plausibile ma campi ancora vuoti.
 */
export function bollaNeedsOcrPass(r: {
  data: string
  file_url: string | null
  importo: number | null
  numero_bolla: string | null
}): boolean {
  if (!r.file_url?.trim()) return false
  if (isSuspiciousDocumentDate(r.data)) return true
  if (!r.numero_bolla?.trim()) return true
  if (r.importo == null || Number.isNaN(Number(r.importo))) return true
  return false
}

export function fatturaNeedsOcrPass(r: {
  data: string
  file_url: string | null
  importo: number | null
  numero_fattura: string | null
}): boolean {
  if (!r.file_url?.trim()) return false
  if (isSuspiciousDocumentDate(r.data)) return true
  if (!r.numero_fattura?.trim()) return true
  if (r.importo == null || Number.isNaN(Number(r.importo))) return true
  return false
}

export function resolvedContentTypeFromFetch(url: string, header: string | null): string {
  const h = (header ?? '').toLowerCase()
  if (h.includes('pdf')) return 'application/pdf'
  if (h.includes('jpeg') || h.includes('jpg')) return 'image/jpeg'
  if (h.includes('png')) return 'image/png'
  if (h.includes('webp')) return 'image/webp'
  if (h.includes('gif')) return 'image/gif'
  const u = url.toLowerCase().split('?')[0] ?? ''
  if (u.endsWith('.pdf')) return 'application/pdf'
  if (/\.jpe?g$/i.test(u)) return 'image/jpeg'
  if (u.endsWith('.png')) return 'image/png'
  if (u.endsWith('.webp')) return 'image/webp'
  if (u.endsWith('.gif')) return 'image/gif'
  return h || 'application/octet-stream'
}

/**
 * Quando lo storage restituisce `application/octet-stream` o header vuoto, ricava
 * il MIME dai magic bytes (scan AI / upload senza estensione nell’URL).
 */
function daysBeforeReceipt(proposed: string, receivedAt: string): number {
  const recv = receivedAt.slice(0, 10)
  const diffMs = new Date(recv).getTime() - new Date(proposed).getTime()
  return diffMs / (1000 * 60 * 60 * 24)
}

/** Data troppo vecchia rispetto alla ricezione email/archiviazione (es. periodo estratto conto). */
export function isStaleRelativeToReceipt(
  proposed: string,
  receivedAt: string | null | undefined,
  maxDaysBefore = 180,
): boolean {
  const recv = receivedAt?.slice(0, 10)
  if (!recv || !/^\d{4}-\d{2}-\d{2}$/.test(proposed)) return false
  if (proposed > recv) return false
  return daysBeforeReceipt(proposed, recv) > maxDaysBefore
}

/** Data plausibile per un documento già in archivio (non sospetta e coerente con ricezione). */
export function isPlausibleStoredDocumentDate(
  data: string | null | undefined,
  receivedAt?: string | null,
): boolean {
  if (!data?.trim() || isSuspiciousDocumentDate(data)) return false
  if (receivedAt && isStaleRelativeToReceipt(data, receivedAt)) return false
  return true
}

export function inferContentTypeFromBuffer(buf: ArrayBuffer | Buffer): string | null {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(new Uint8Array(buf as ArrayBuffer))
  if (b.length < 12) return null
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'application/pdf'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.length >= 12 && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}
