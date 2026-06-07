import { tipoDocumentoToLabel } from '@/lib/extract-doc-type'

export type FatturaRefreshOcrResponse = {
  error?: string
  ok?: boolean
  data?: string
  data_changed?: boolean
  date_rejected?: boolean
  info?: string
  importo?: number | null
  importo_changed?: boolean
  numero_fattura?: string | null
  numero_fattura_changed?: boolean
  tipo_documento?: string | null
  fornitore_reassigned?: boolean
  nuovo_fornitore_nome?: string | null
}

export type FatturaRefreshOcrCallbacks = {
  onDataUpdated: (newIsoDate: string) => void
  onImportoUpdated?: (newImporto: number) => void
  onNumeroFatturaUpdated?: (newNumero: string) => void
  onTipoDocumentoUpdated?: (tipo: string) => void
}

export async function fetchFatturaRefreshFromOcr(
  fatturaId: string,
): Promise<{ ok: true; body: FatturaRefreshOcrResponse } | { ok: false; status: number; body: FatturaRefreshOcrResponse }> {
  const res = await fetch('/api/fatture/refresh-date-from-ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fattura_id: fatturaId }),
    credentials: 'include',
  })
  const body = (await res.json().catch(() => ({}))) as FatturaRefreshOcrResponse
  if (!res.ok) return { ok: false, status: res.status, body }
  return { ok: true, body }
}

/** Applica la risposta OCR e restituisce se qualcosa è cambiato. */
export function applyFatturaRefreshOcrResponse(
  j: FatturaRefreshOcrResponse,
  callbacks: FatturaRefreshOcrCallbacks,
): boolean {
  if (j.tipo_documento) {
    const label = tipoDocumentoToLabel(j.tipo_documento)
    if (label) callbacks.onTipoDocumentoUpdated?.(label)
  }
  const dataChanged = j.data_changed === true
  const importoChanged = j.importo_changed === true && j.importo != null
  const numeroChanged = j.numero_fattura_changed === true && j.numero_fattura != null
  const fornitoreReassigned = j.fornitore_reassigned === true
  if (j.data && dataChanged) callbacks.onDataUpdated(j.data)
  if (importoChanged) callbacks.onImportoUpdated?.(j.importo as number)
  if (numeroChanged) callbacks.onNumeroFatturaUpdated?.(j.numero_fattura as string)
  return dataChanged || importoChanged || numeroChanged || fornitoreReassigned
}
