import { logger } from '@/lib/logger'

export type DocumentExtractionResult = {
  text: string | null
  format: 'pdf' | 'docx' | 'txt' | 'image' | 'unsupported'
  errorMessage: string | null
}

const TEXT_PLAIN = 'text/plain'
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export async function extractTextFromDocx(buf: Buffer): Promise<string | null> {
  try {
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(buf)
    const docFile = zip.file('word/document.xml')
    if (!docFile) {
      logger.warn('[DOCX-EXT] word/document.xml non trovato nell\'archivio DOCX')
      return null
    }
    const xmlStr = await docFile.async('string')
    const text = xmlStr
      .replace(/<w:p[^>]*>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    return text || null
  } catch (err) {
    logger.error('[DOCX-EXT] Errore estrazione testo DOCX:', err)
    return null
  }
}

export function extractTextFromTxt(buf: Buffer): string | null {
  try {
    const text = buf.toString('utf-8').trim()
    return text || null
  } catch (err) {
    logger.error('[TXT-EXT] Errore decodifica testo TXT:', err)
    return null
  }
}

export async function extractDocumentText(
  buf: Buffer,
  contentType: string,
): Promise<DocumentExtractionResult> {
  if (contentType === 'application/pdf') {
    const { extractPdfText } = await import('@/lib/pdf-parse-utils')
    const text = await extractPdfText(buf)
    return { text, format: 'pdf', errorMessage: text ? null : 'Nessun testo estraibile dal PDF' }
  }

  if (contentType === DOCX_MIME) {
    const text = await extractTextFromDocx(buf)
    return {
      text,
      format: 'docx',
      errorMessage: text ? null : 'Impossibile estrarre testo dal DOCX',
    }
  }

  if (contentType === TEXT_PLAIN) {
    const text = extractTextFromTxt(buf)
    return { text, format: 'txt', errorMessage: text ? null : 'File TXT vuoto' }
  }

  const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (imageTypes.includes(contentType)) {
    return { text: null, format: 'image', errorMessage: null }
  }

  return { text: null, format: 'unsupported', errorMessage: `Formato non supportato: ${contentType}` }
}

export function isTextBasedExtractable(contentType: string): boolean {
  return contentType === 'application/pdf' || contentType === DOCX_MIME || contentType === TEXT_PLAIN
}
