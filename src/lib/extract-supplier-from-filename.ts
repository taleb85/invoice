import { extractStatementFromSupplierName } from '@/lib/statement-supplier-subject'

function basenameWithoutExtension(fileName: string): string {
  const base = fileName.trim().split(/[/\\]/).pop() ?? ''
  return base.replace(/\.[a-z0-9]{2,5}$/i, '').trim()
}

function humanizeUnderscoreName(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Es. QuickBooks: `Invoice_43284_from_Saggiomo_Luxury_Foods_Ltd.pdf` → Saggiomo Luxury Foods Ltd
 */
export function extractSupplierNameFromAttachmentFileName(
  fileName: string | null | undefined,
): string | null {
  const base = basenameWithoutExtension(fileName ?? '')
  if (base.length < 6) return null

  const patterns = [
    /(?:^|_)from[_-](.+)$/i,
    /\binvoice[_\s-]+\d+[_\s-]+from[_\s-]+(.+)$/i,
    /\bstatement[_\s-]+from[_\s-]+(.+)$/i,
  ]

  for (const re of patterns) {
    const m = base.match(re)
    if (!m?.[1]) continue
    const name = humanizeUnderscoreName(m[1])
    if (name.length >= 4 && !/^\d+$/.test(name)) return name
  }

  return null
}

/** Nome fornitore dedotto da file, oggetto mail o metadata OCR. */
export function extractSupplierHintFromDocContext(
  fileName: string | null | undefined,
  subject: string | null | undefined,
  metadata: unknown,
): string | null {
  const fromFile = extractSupplierNameFromAttachmentFileName(fileName)
  if (fromFile) return fromFile

  const fromSubject = extractStatementFromSupplierName(subject)
  if (fromSubject) return fromSubject

  const meta =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {}
  const rs = typeof meta.ragione_sociale === 'string' ? meta.ragione_sociale.trim() : ''
  return rs.length >= 4 ? rs : null
}
