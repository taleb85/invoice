import { logger } from '@/lib/logger'

export type DocumentValidationWarning =
  | { code: 'PDF_ENCRYPTED'; message: string }
  | { code: 'PDF_CORRUPT'; message: string }
  | { code: 'PDF_EMPTY_TEXT'; message: string }
  | { code: 'FILE_TOO_SMALL'; message: string; minBytes: number; actualBytes: number }
  | { code: 'FILE_TOO_LARGE'; message: string; maxBytes: number; actualBytes: number }
  | { code: 'CONTENT_TYPE_MISMATCH'; message: string; declared: string; inferred: string | null }
  | { code: 'UNSUPPORTED_TYPE'; message: string; contentType: string }
  | { code: 'LARGE_FILE_FOR_VISION'; message: string; bytes: number; estimatedTokens: number }
  | { code: 'PDF_TRUNCATED'; message: string }
  | { code: 'PDF_PASSWORD_PROTECTED'; message: string }

export type DocumentValidationResult = {
  valid: boolean
  warnings: DocumentValidationWarning[]
  metadata: {
    sizeBytes: number
    inferredContentType: string | null
    isEncrypted: boolean
    isCorrupted: boolean
    isTruncated: boolean
    pageCount: number | null
    textPreview: string | null
  }
}

const MAX_FILE_BYTES = 25 * 1024 * 1024
const MIN_FILE_BYTES = 50
const PDF_ENCRYPT_HEADER = '/Encrypt'
const PDF_HEADER = '%PDF'

function inferContentTypeFromBuffer(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return 'application/pdf'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.length >= 12 && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

function isPdfEncrypted(buf: Buffer): boolean {
  if (buf.length < 100) return false
  const asciiPortion = buf.toString('ascii').slice(0, 8192)
  return asciiPortion.includes(PDF_ENCRYPT_HEADER)
}

function isPdfTruncated(buf: Buffer): boolean {
  const endMarker = '%%EOF'
  const str = buf.toString('ascii', Math.max(0, buf.length - 100), buf.length)
  return !str.includes(endMarker)
}

function isPdfCorrupted(buf: Buffer): boolean {
  if (buf.length < 10) return true
  const str = buf.toString('ascii', 0, Math.min(buf.length, 200))
  if (!str.startsWith(PDF_HEADER) && !str.startsWith('%PDF')) return true
  if (str.startsWith(PDF_HEADER)) {
    const versionMatch = str.match(/^%PDF-\d+\.\d+/)
    if (!versionMatch) return true
  }
  return false
}

function estimateTokensForBase64(bytes: number): number {
  const base64Len = Math.ceil(bytes * 4 / 3)
  return Math.ceil(base64Len / 4)
}

export function validateDocument(
  buf: Buffer,
  declaredContentType: string | null,
  options?: {
    maxBytes?: number
    minBytes?: number
  },
): DocumentValidationResult {
  const warnings: DocumentValidationWarning[] = []
  const sizeBytes = buf.length
  const maxBytes = options?.maxBytes ?? MAX_FILE_BYTES
  const minBytes = options?.minBytes ?? MIN_FILE_BYTES

  if (sizeBytes < minBytes) {
    warnings.push({
      code: 'FILE_TOO_SMALL',
      message: `File troppo piccolo (${sizeBytes} bytes, minimo ${minBytes}) — probabilmente vuoto o corrotto.`,
      minBytes,
      actualBytes: sizeBytes,
    })
  }

  if (sizeBytes > maxBytes) {
    warnings.push({
      code: 'FILE_TOO_LARGE',
      message: `File troppo grande (${(sizeBytes / 1024 / 1024).toFixed(1)} MB, massimo ${(maxBytes / 1024 / 1024).toFixed(0)} MB).`,
      maxBytes,
      actualBytes: sizeBytes,
    })
  }

  const inferredType = inferContentTypeFromBuffer(buf)

  if (declaredContentType && inferredType && declaredContentType !== inferredType) {
    warnings.push({
      code: 'CONTENT_TYPE_MISMATCH',
      message: `Il tipo MIME dichiarato (${declaredContentType}) non corrisponde al contenuto effettivo (${inferredType}).`,
      declared: declaredContentType,
      inferred: inferredType,
    })
  }

  if (inferredType === 'application/pdf') {
    const isEncrypted = isPdfEncrypted(buf)
    const isTruncated = isPdfTruncated(buf)
    const isCorrupted = isPdfCorrupted(buf)

    if (isEncrypted) {
      warnings.push({
        code: 'PDF_ENCRYPTED',
        message: 'Il PDF è crittografato/protetto da password — Gemini non può leggerlo. Richiedere un documento non protetto.',
      })
      warnings.push({
        code: 'PDF_PASSWORD_PROTECTED',
        message: 'PDF protetto da password: impossibile estrarre testo o elaborare con AI.',
      })
    }

    if (isTruncated) {
      warnings.push({
        code: 'PDF_TRUNCATED',
        message: 'Il PDF sembra troncato (manca %%EOF) — potrebbe essere danneggiato o scaricato parzialmente.',
      })
    }

    if (isCorrupted) {
      warnings.push({
        code: 'PDF_CORRUPT',
        message: `Il PDF non ha un header valido — il file potrebbe essere corrotto o non essere un PDF.`,
      })
    }

    if (sizeBytes > 10 * 1024 * 1024) {
      const estimatedTokens = estimateTokensForBase64(buf.length)
      warnings.push({
        code: 'LARGE_FILE_FOR_VISION',
        message: `File grande (${(sizeBytes / 1024 / 1024).toFixed(1)} MB, stimati ~${(estimatedTokens / 1000).toFixed(0)}K token) — potrebbe superare i limiti di Gemini o causare timeout.`,
        bytes: sizeBytes,
        estimatedTokens,
      })
    }
  }

  if (declaredContentType && !inferredType) {
    const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!supportedTypes.includes(declaredContentType)) {
      warnings.push({
        code: 'UNSUPPORTED_TYPE',
        message: `Tipo MIME non supportato: ${declaredContentType}. Formati supportati: PDF, JPEG, PNG, WebP, GIF, DOCX, TXT.`,
        contentType: declaredContentType,
      })
    }
  }

  const valid = warnings.length === 0 || warnings.every(
    (w) => w.code !== 'FILE_TOO_LARGE' && w.code !== 'PDF_ENCRYPTED' && w.code !== 'PDF_CORRUPT',
  )

  const textPreview = inferredType === 'text/plain'
    ? buf.toString('utf-8').slice(0, 500)
    : null

  return {
    valid,
    warnings,
    metadata: {
      sizeBytes,
      inferredContentType: inferredType,
      isEncrypted: inferredType === 'application/pdf' && isPdfEncrypted(buf),
      isCorrupted: inferredType === 'application/pdf' && isPdfCorrupted(buf),
      isTruncated: inferredType === 'application/pdf' && isPdfTruncated(buf),
      pageCount: null,
      textPreview,
    },
  }
}

export function logValidationWarnings(
  context: string,
  result: DocumentValidationResult,
): void {
  for (const w of result.warnings) {
    logger.warn(`[DOC-VALID] ${context}: ${w.message}`, {
      code: w.code,
      sizeBytes: result.metadata.sizeBytes,
      inferredType: result.metadata.inferredContentType,
    })
  }
  if (!result.valid) {
    logger.error(`[DOC-VALID] ${context}: Validazione fallita — ${result.warnings.length} problema(i).`, {
      warnings: result.warnings.map((w) => w.code),
    })
  } else if (result.warnings.length > 0) {
    logger.info(`[DOC-VALID] ${context}: Documento valido con ${result.warnings.length} avviso(i).`)
  } else {
    logger.info(`[DOC-VALID] ${context}: Documento valido — nessun problema.`)
  }
}

export const SUPPORTED_OCR_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

export function isContentTypeSupported(ct: string): boolean {
  return (SUPPORTED_OCR_CONTENT_TYPES as readonly string[]).includes(ct)
}
