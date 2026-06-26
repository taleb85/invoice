import {
  applyFatturaRefreshOcrResponse,
  fetchFatturaRefreshFromOcr,
  type FatturaRefreshOcrCallbacks,
  type FatturaRefreshOcrResponse,
} from '@/lib/fattura-refresh-from-ocr-client'

export type BollaRefreshOcrResponse = {
  error?: string
  ok?: boolean
  data?: string
  data_changed?: boolean
  date_rejected?: boolean
  info?: string
  numero_bolla?: string | null
  numero_bolla_changed?: boolean
  quantita?: number | null
  quantita_changed?: boolean
}

export type ConfermaRefreshOcrResponse = {
  error?: string
  ok?: boolean
  data_ordine?: string | null
  data_ordine_changed?: boolean
  info?: string
  numero_ordine?: string | null
  numero_ordine_changed?: boolean
  importo_totale?: number | null
  importo_totale_changed?: boolean
}

export type BollaRefreshOcrCallbacks = {
  onDataUpdated: (newIsoDate: string) => void
  onNumeroBollaUpdated?: (newNumero: string) => void
  onQuantitaUpdated?: (newQuantita: number) => void
}

export type ConfermaRefreshOcrCallbacks = {
  onDataOrdineUpdated: (newIsoDate: string) => void
  onNumeroOrdineUpdated?: (newNumero: string) => void
  onImportoTotaleUpdated?: (importo: number) => void
}

export async function fetchBollaRefreshFromOcr(
  bollaId: string,
): Promise<{ ok: true; body: BollaRefreshOcrResponse } | { ok: false; status: number; body: BollaRefreshOcrResponse }> {
  const res = await fetch('/api/bolle/refresh-from-ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bolla_id: bollaId }),
    credentials: 'include',
  })
  const body = (await res.json().catch(() => ({}))) as BollaRefreshOcrResponse
  if (!res.ok) return { ok: false, status: res.status, body }
  return { ok: true, body }
}

export function applyBollaRefreshOcrResponse(
  j: BollaRefreshOcrResponse,
  callbacks: BollaRefreshOcrCallbacks,
): boolean {
  const dataChanged = j.data_changed === true && Boolean(j.data)
  const numeroChanged = j.numero_bolla_changed === true && j.numero_bolla != null
  const quantitaChanged = j.quantita_changed === true && j.quantita != null
  if (j.data && dataChanged) callbacks.onDataUpdated(j.data)
  if (numeroChanged) callbacks.onNumeroBollaUpdated?.(j.numero_bolla as string)
  if (quantitaChanged) callbacks.onQuantitaUpdated?.(j.quantita as number)
  return dataChanged || numeroChanged || quantitaChanged
}

export async function fetchConfermaRefreshFromOcr(
  confermaId: string,
): Promise<
  { ok: true; body: ConfermaRefreshOcrResponse } | { ok: false; status: number; body: ConfermaRefreshOcrResponse }
> {
  const res = await fetch('/api/conferme-ordine/refresh-from-ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conferma_id: confermaId }),
    credentials: 'include',
  })
  const body = (await res.json().catch(() => ({}))) as ConfermaRefreshOcrResponse
  if (!res.ok) return { ok: false, status: res.status, body }
  return { ok: true, body }
}

export function applyConfermaRefreshOcrResponse(
  j: ConfermaRefreshOcrResponse,
  callbacks: ConfermaRefreshOcrCallbacks,
): boolean {
  const dataChanged = j.data_ordine_changed === true && Boolean(j.data_ordine)
  const numeroChanged = j.numero_ordine_changed === true && j.numero_ordine != null
  const importo =
    j.importo_totale != null && Number.isFinite(Number(j.importo_totale))
      ? Math.round(Number(j.importo_totale) * 100) / 100
      : null
  const importoChanged = j.importo_totale_changed === true && importo != null
  if (j.data_ordine && dataChanged) callbacks.onDataOrdineUpdated(j.data_ordine)
  if (numeroChanged) callbacks.onNumeroOrdineUpdated?.(j.numero_ordine as string)
  if (importo != null) callbacks.onImportoTotaleUpdated?.(importo)
  return dataChanged || numeroChanged || importoChanged
}

export async function fetchPendingDocRefreshFromOcr(
  documentoId: string,
): Promise<{ ok: boolean; body: { error?: string } }> {
  const res = await fetch('/api/documenti-da-processare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: documentoId, azione: 'rianalizza_ocr' }),
    credentials: 'include',
  })
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return { ok: res.ok, body }
}

export type DocumentOcrRefreshTarget =
  | ({ kind: 'fattura'; fatturaId: string; numero?: string | null } & FatturaRefreshOcrCallbacks)
  | ({ kind: 'bolla'; bollaId: string; numero?: string | null } & BollaRefreshOcrCallbacks)
  | ({ kind: 'conferma'; confermaId: string; numero?: string | null } & ConfermaRefreshOcrCallbacks)
  | { kind: 'pending'; documentoId: string; numero?: string | null }

export function documentOcrRefreshTargetId(target: DocumentOcrRefreshTarget): string {
  switch (target.kind) {
    case 'fattura':
      return target.fatturaId
    case 'bolla':
      return target.bollaId
    case 'conferma':
      return target.confermaId
    case 'pending':
      return target.documentoId
  }
}

export async function runDocumentOcrRefresh(
  target: DocumentOcrRefreshTarget,
): Promise<{ ok: boolean; changed: boolean; body: FatturaRefreshOcrResponse | BollaRefreshOcrResponse | ConfermaRefreshOcrResponse | { error?: string } }> {
  if (target.kind === 'fattura') {
    const result = await fetchFatturaRefreshFromOcr(target.fatturaId)
    if (!result.ok) return { ok: false, changed: false, body: result.body }
    const changed = applyFatturaRefreshOcrResponse(result.body, target)
    return { ok: true, changed, body: result.body }
  }
  if (target.kind === 'bolla') {
    const result = await fetchBollaRefreshFromOcr(target.bollaId)
    if (!result.ok) return { ok: false, changed: false, body: result.body }
    const changed = applyBollaRefreshOcrResponse(result.body, target)
    return { ok: true, changed, body: result.body }
  }
  if (target.kind === 'conferma') {
    const result = await fetchConfermaRefreshFromOcr(target.confermaId)
    if (!result.ok) return { ok: false, changed: false, body: result.body }
    const changed = applyConfermaRefreshOcrResponse(result.body, target)
    return { ok: true, changed, body: result.body }
  }
  const result = await fetchPendingDocRefreshFromOcr(target.documentoId)
  return { ok: result.ok, changed: result.ok, body: result.body }
}

export { fetchFatturaRefreshFromOcr, applyFatturaRefreshOcrResponse, type FatturaRefreshOcrCallbacks }
