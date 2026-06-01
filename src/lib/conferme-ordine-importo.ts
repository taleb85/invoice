import { parseAnyAmount } from '@/lib/ocr-amount'

export type ConfermaOrdineRigaImporto = {
  quantita?: number | null
  prezzo_unitario?: number | null
  importo_linea?: number | null
}

function lineImporto(r: ConfermaOrdineRigaImporto): number | null {
  if (typeof r.importo_linea === 'number' && Number.isFinite(r.importo_linea)) {
    return r.importo_linea
  }
  const q = typeof r.quantita === 'number' && Number.isFinite(r.quantita) ? r.quantita : null
  const p =
    typeof r.prezzo_unitario === 'number' && Number.isFinite(r.prezzo_unitario)
      ? r.prezzo_unitario
      : null
  if (q != null && p != null) return Math.round(q * p * 100) / 100
  return null
}

/** Somma righe prodotto (Rekki / jsonb `righe`). */
export function sumConfermaOrdineRigheImporto(righe: unknown): number | null {
  if (!Array.isArray(righe) || righe.length === 0) return null
  let total = 0
  let found = false
  for (const raw of righe) {
    if (!raw || typeof raw !== 'object') continue
    const v = lineImporto(raw as ConfermaOrdineRigaImporto)
    if (v != null) {
      total += v
      found = true
    }
  }
  return found ? Math.round(total * 100) / 100 : null
}

/** Totale lordo da metadata OCR (`documenti_da_processare`). */
export function totaleFromDocMetadata(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const m = metadata as { totale_iva_inclusa?: unknown; importo_raw?: unknown }
  const n = m.totale_iva_inclusa
  if (typeof n === 'number' && Number.isFinite(n)) return Math.round(n * 100) / 100
  if (typeof n === 'string' && n.trim()) {
    const p = parseAnyAmount(n)
    if (p != null && Number.isFinite(p)) return Math.round(p * 100) / 100
  }
  const raw = m.importo_raw
  if (typeof raw === 'string' && raw.trim()) {
    const p = parseAnyAmount(raw)
    if (p != null && Number.isFinite(p)) return Math.round(p * 100) / 100
  }
  return null
}

/** Importo da mostrare: righe prodotto, altrimenti totale documento OCR. */
export function confermaOrdineImportoTotale(row: {
  righe: unknown
  importo_totale?: number | null
}): number | null {
  return sumConfermaOrdineRigheImporto(row.righe) ?? row.importo_totale ?? null
}
