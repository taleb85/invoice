import { listinoGroupKey } from '@/lib/listino-display'
import {
  parseListinoNoteOrderQty,
  resolveListinoUnitPriceForDisplay,
} from '@/lib/listino-invoice-line-normalize'
import {
  isBadListinoOcrPrice,
  isLikelyLineTotalOcrPrice,
} from '@/lib/listino-price-sanity'

export type ListinoPriceRepairRow = {
  id: string
  fornitore_id: string
  prodotto: string
  prezzo: number
  data_prezzo: string
  note?: string | null
}

export type ListinoPriceRepairCandidate = ListinoPriceRepairRow & {
  correctedPrezzo: number
  reason: string
}

function amountsClose(a: number, b: number, rel = 0.03): boolean {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return false
  return Math.abs(a - b) / Math.abs(b) <= rel
}

function repairReason(
  before: number,
  after: number,
  note: string | null | undefined,
): string {
  if (/qtà fattura:/i.test(note ?? '')) {
    return 'totale_riga_in_prezzo_con_qta_in_nota'
  }
  if (Math.abs(before / after - 2) < 0.06) {
    return 'prezzo_circa_doppio_unitario'
  }
  if (before > after * 1.5) {
    return 'totale_riga_o_importo_su_storico'
  }
  return 'correzione_ocr_storico'
}

/**
 * Applica correzione solo se il prezzo salvato è chiaramente troppo alto
 * rispetto allo storico o al totale riga (evita di dimezzare unitari già corretti).
 */
export function shouldApplyListinoPriceRepair(
  prezzo: number,
  corrected: number,
  others: number[],
  note?: string | null,
): boolean {
  if (!Number.isFinite(prezzo) || !Number.isFinite(corrected) || prezzo <= 0 || corrected <= 0) {
    return false
  }
  if (Math.abs(corrected - prezzo) < 0.01) return false

  const hist = others.filter((p) => Number.isFinite(p) && p > 0)
  const orderQty = parseListinoNoteOrderQty(note)

  if (hist.length >= 1) {
    const refLo = Math.min(...hist)

    /** Riga già plausibile come unitario (es. 8.99 con storico 17.98 sbagliato). */
    if (prezzo < refLo * 0.92) return false

    const correctedMatchesHist = corrected >= refLo * 0.85 && corrected <= refLo * 1.15
    if (!correctedMatchesHist) return false

    if (isBadListinoOcrPrice(prezzo, hist) || isLikelyLineTotalOcrPrice(prezzo, hist)) {
      return true
    }

    if (
      orderQty != null &&
      orderQty > 1 &&
      amountsClose(prezzo, corrected * orderQty, 0.04) &&
      prezzo > corrected * 1.2
    ) {
      return true
    }

    return false
  }

  /** Prodotto con una sola rilevazione: solo se nota ha qtà e prezzo = totale riga. */
  if (orderQty != null && orderQty > 1) {
    return (
      amountsClose(prezzo, corrected * orderQty, 0.04) &&
      prezzo > corrected * 1.35 &&
      corrected < prezzo * 0.75
    )
  }

  return false
}

/**
 * Righe listino il cui `prezzo` va aggiornato al prezzo unitario effettivo.
 */
export function findListinoPriceRepairs(all: ListinoPriceRepairRow[]): ListinoPriceRepairCandidate[] {
  const byGroup = new Map<string, ListinoPriceRepairRow[]>()

  for (const row of all) {
    const prezzo = typeof row.prezzo === 'number' ? row.prezzo : parseFloat(String(row.prezzo))
    if (!Number.isFinite(prezzo) || prezzo <= 0) continue
    const normalized: ListinoPriceRepairRow = {
      ...row,
      prodotto: row.prodotto.trim(),
      prezzo,
      data_prezzo: row.data_prezzo.slice(0, 10),
    }
    const key = `${row.fornitore_id}\0${listinoGroupKey(normalized)}`
    const arr = byGroup.get(key) ?? []
    arr.push(normalized)
    byGroup.set(key, arr)
  }

  const repairs: ListinoPriceRepairCandidate[] = []

  for (const group of byGroup.values()) {
    for (const row of group) {
      const others = group.filter((g) => g.id !== row.id).map((g) => g.prezzo)
      const corrected = resolveListinoUnitPriceForDisplay(row.prezzo, row.note, others)
      if (!shouldApplyListinoPriceRepair(row.prezzo, corrected, others, row.note)) continue

      repairs.push({
        ...row,
        correctedPrezzo: corrected,
        reason: repairReason(row.prezzo, corrected, row.note),
      })
    }
  }

  return repairs.sort((a, b) => {
    const f = a.fornitore_id.localeCompare(b.fornitore_id)
    if (f !== 0) return f
    return a.prodotto.localeCompare(b.prodotto)
  })
}
