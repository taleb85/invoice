import type { OcrResult } from '@/lib/ocr-invoice'
import {
  fiscalSegmentsBeyondPrimary,
  type OcrPdfSegment,
} from '@/lib/ocr-pdf-multi'
import { normalizeTipoDocumento } from '@/lib/ocr-tipo-documento'

export type PdfSegmentQueueMeta = {
  pdf_segmento: {
    indice: number
    pagina_inizio: number | null
    pagina_fine: number | null
    pdf_multiplo: true
  }
  tipo_documento: string | null
  numero_fattura: string | null
  data_fattura: string | null
  totale_iva_inclusa: number | null
  ragione_sociale: string | null
  pending_kind?: 'fattura' | 'bolla' | 'nota_credito' | 'ordine'
}

export function buildPdfSegmentQueueMetadata(
  segment: OcrPdfSegment,
  indice: number,
): PdfSegmentQueueMeta {
  const tipo = segment.tipo_documento
  let pending_kind: PdfSegmentQueueMeta['pending_kind']
  if (tipo === 'fattura') pending_kind = 'fattura'
  else if (tipo === 'nota_credito') pending_kind = 'nota_credito'
  else if (tipo === 'bolla_ddt') pending_kind = 'bolla'
  else if (tipo === 'ordine') pending_kind = 'ordine'

  return {
    pdf_segmento: {
      indice,
      pagina_inizio: segment.pagina_inizio,
      pagina_fine: segment.pagina_fine,
      pdf_multiplo: true,
    },
    tipo_documento: tipo,
    numero_fattura: segment.numero_fattura,
    data_fattura: segment.data_fattura,
    totale_iva_inclusa: segment.totale_iva_inclusa,
    ragione_sociale: segment.ragione_sociale,
    ...(pending_kind ? { pending_kind } : {}),
  }
}

/** Segmenti fiscali aggiuntivi da inserire in coda (stesso PDF, numeri/tipi diversi). */
export function extraPdfSegmentsForQueue(ocr: OcrResult): OcrPdfSegment[] {
  const segs = ocr.segmenti_pdf
  if (!segs?.length) return []
  const primaryTipo = normalizeTipoDocumento(ocr.tipo_documento)
  return fiscalSegmentsBeyondPrimary(segs, primaryTipo, ocr.numero_fattura)
}

/** Chiave dedup: stesso file + stesso segmento o stesso numero fiscale. */
export function pdfSegmentDedupKey(
  fileUrl: string,
  metadata: Record<string, unknown> | null | undefined,
): string {
  const meta = metadata ?? {}
  const seg = meta.pdf_segmento as { indice?: number } | undefined
  if (seg && typeof seg.indice === 'number') {
    return `${fileUrl}::seg:${seg.indice}`
  }
  const num = typeof meta.numero_fattura === 'string' ? meta.numero_fattura.trim() : ''
  const tipo = typeof meta.tipo_documento === 'string' ? meta.tipo_documento.trim() : ''
  if (num) return `${fileUrl}::${tipo}:${num}`
  return fileUrl
}
