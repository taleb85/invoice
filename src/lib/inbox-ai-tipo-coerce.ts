import {
  documentOcrContextSuggestsQuotation,
  scanContextLooksLikeOrderConfirmationDoc,
} from '@/lib/document-bozza-routing'

/** Strong signals this is a CV / job application — must not be coerced or left as listino. */
const CV_OR_JOB_APPLICATION_HINT =
  /\.cv[\._]|_[\._]cv\b|\bcv\s*[_\.\-]?\s*\d|curriculum\s*vitae|\bcurriculum\b|résumé|\bresume\b|modulo\s+di\s+candidatura|candidatura\s+di\s+lavoro|job\s*application|lettera\s+(di\s+)?(presentazione|motivazione)|domanda\s+di\s+impiego|employment\s+application|application\s+for\s+(the\s+)?position/i

/** Filename / caption signals (EN+IT): supplier price communiques often mis-labelled as altro. */
const LISTINO_PRICE_DOC_HINT =
  /price\s*update|price\s*list|pricelist|price\s*sheet|\bpricing\b|new\s*prices?|supplier\s+(price|prices|list)|listino|aggiornam\w*\s*(prezzi|tariffe)|tariff(ar)?io|riferimento\s+prezzi|articoli\s*[&+]?\s*prices?/iu

const SALES_OR_PO_DOC_HINT =
  /\bsales\s+order\b|\bpurchase\s+order\b|\bwork\s+order\b|\border\s+confirmation\b|\bpo\s+acknowledg/i

export function coerceListinoFromSignals(
  fileName: string | null | undefined,
  tipo_raw: string,
  confidenza: number,
  azione_consigliata: string,
): { tipo_suggerito: string; confidenza: number } {
  const tipo = (tipo_raw || 'altro').toLowerCase().trim()
  const blobCheck = `${fileName ?? ''}\n${azione_consigliata ?? ''}`

  if (CV_OR_JOB_APPLICATION_HINT.test(blobCheck)) {
    return { tipo_suggerito: 'altro', confidenza: Math.min(confidenza, 0.92) }
  }

  if (tipo === 'listino') {
    return { tipo_suggerito: 'listino', confidenza }
  }

  const blob = `${fileName ?? ''}\n${azione_consigliata ?? ''}`
  if (LISTINO_PRICE_DOC_HINT.test(blob) && tipo === 'altro') {
    return {
      tipo_suggerito: 'listino',
      confidenza: Math.min(1, Math.max(confidenza, 0.93)),
    }
  }
  return { tipo_suggerito: tipo_raw || 'altro', confidenza }
}

/** Corregge classificazioni leggere (Gemini classify) con segnali nome file / oggetto mail. */
export function coerceInboxTipoFromSignals(
  fileName: string | null | undefined,
  tipo_raw: string,
  confidenza: number,
  azione_consigliata: string,
  oggetto_mail?: string | null,
): { tipo_suggerito: string; confidenza: number } {
  const r = coerceListinoFromSignals(fileName, tipo_raw, confidenza, azione_consigliata)
  const tipo = (r.tipo_suggerito || 'altro').toLowerCase().trim()
  const blob = `${fileName ?? ''}\n${oggetto_mail ?? ''}\n${azione_consigliata ?? ''}`

  if (documentOcrContextSuggestsQuotation(null, { oggetto_mail, file_name: fileName }) || /\bquotation\b|preventivo/i.test(blob)) {
    return { tipo_suggerito: 'altro', confidenza: Math.min(1, Math.max(r.confidenza, 0.9)) }
  }

  if (tipo === 'ordine' && /\bquotation\b|preventivo/i.test(blob)) {
    return { tipo_suggerito: 'altro', confidenza: Math.min(r.confidenza, 0.88) }
  }

  if (tipo !== 'altro' && tipo !== 'ordine') return r

  if (
    scanContextLooksLikeOrderConfirmationDoc(oggetto_mail, fileName) ||
    SALES_OR_PO_DOC_HINT.test(blob)
  ) {
    return {
      tipo_suggerito: 'ordine',
      confidenza: Math.min(1, Math.max(r.confidenza, 0.93)),
    }
  }

  return r
}
