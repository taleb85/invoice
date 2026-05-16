import { logger } from '@/lib/logger'

export type PdfParseFailureReason =
  | 'password_protected'
  | 'corrupted'
  | 'empty'
  | 'timeout'
  | 'unknown_error'
  | 'no_text_extractable'

export type PdfParseResult = {
  text: string | null
  failureReason: PdfParseFailureReason | null
  errorMessage: string | null
  pageCount: number | null
}

function detectPdfFailureReason(error: unknown): { reason: PdfParseFailureReason; message: string } {
  const msg = String(error)
  const lower = msg.toLowerCase()

  if (lower.includes('password') || lower.includes('encrypt') || lower.includes('decrypt')) {
    return { reason: 'password_protected', message: 'PDF protetto da password — impossibile estrarre il testo.' }
  }
  if (lower.includes('invalid') || lower.includes('corrupt') || lower.includes('format') || lower.includes('parse')) {
    return { reason: 'corrupted', message: `PDF corrotto o malformato: ${msg.slice(0, 200)}` }
  }
  if (lower.includes('timeout') || lower.includes('abort')) {
    return { reason: 'timeout', message: `Timeout durante l\'elaborazione del PDF: ${msg.slice(0, 200)}` }
  }
  if (lower.includes('range error') || lower.includes('buffer') || lower.includes('eof')) {
    return { reason: 'corrupted', message: `PDF strutturalmente invalido: ${msg.slice(0, 200)}` }
  }

  return { reason: 'unknown_error', message: `Errore sconosciuto pdf-parse: ${msg.slice(0, 300)}` }
}

export async function extractPdfTextDetailed(buffer: Buffer): Promise<PdfParseResult> {
  const defaultResult: PdfParseResult = { text: null, failureReason: null, errorMessage: null, pageCount: null }

  if (buffer.length < 50) {
    logger.warn('[PDF-PARSE] Buffer troppo piccolo per essere un PDF valido', { bytes: buffer.length })
    return { ...defaultResult, failureReason: 'corrupted', errorMessage: `Buffer troppo piccolo (${buffer.length} bytes)` }
  }

  const isEncrypted = buffer.toString('ascii', 0, 8192).includes('/Encrypt')
  if (isEncrypted) {
    logger.warn('[PDF-PARSE] PDF crittografato rilevato da magic bytes (/Encrypt)')
    return { ...defaultResult, failureReason: 'password_protected', errorMessage: 'PDF protetto da password (rilevato header /Encrypt)' }
  }

  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buffer })

    try {
      const result = await parser.getText()
      const text = result.text?.trim() || null
      const pageCount = result.total

      if (!text) {
        logger.info('[PDF-PARSE] PDF analizzato — nessun testo estraibile (PDF scansionato o solo immagini)', { pageCount })
        return { text: null, failureReason: 'no_text_extractable', errorMessage: null, pageCount }
      }

      const charCount = text.length
      if (charCount < 20) {
        logger.info('[PDF-PARSE] PDF analizzato — testo troppo corto per essere significativo', { charCount, pageCount })
        return { text, failureReason: null, errorMessage: null, pageCount }
      }

      logger.info('[PDF-PARSE] Testo PDF estratto con successo', {
        charCount,
        pageCount,
        preview: text.slice(0, 100).replace(/\n/g, ' '),
      })

      return { text, failureReason: null, errorMessage: null, pageCount }
    } catch (err: unknown) {
      const { reason, message } = detectPdfFailureReason(err)
      logger.error('[PDF-PARSE] Errore durante estrazione testo PDF', {
        reason,
        error: message,
        stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
      })
      return { ...defaultResult, failureReason: reason, errorMessage: message }
    } finally {
      try {
        await parser.destroy()
      } catch {
      }
    }
  } catch (importErr) {
    const msg = `Importazione pdf-parse fallita: ${importErr}`
    logger.error('[PDF-PARSE]', { error: msg })
    return { ...defaultResult, failureReason: 'unknown_error', errorMessage: msg }
  }
}

export async function extractPdfText(buffer: Buffer): Promise<string | null> {
  const result = await extractPdfTextDetailed(buffer)
  return result.text
}
