import type { SupabaseClient } from '@supabase/supabase-js'
import { compareIsoDateStrings, isDocumentDateAtLeastLatestListino } from '@/lib/listino-document-date'

export type ParsedListinoInsertRow = {
  fornitore_id: string
  prodotto: string
  prezzo: number
  data_prezzo: string
  note: string | null
  force_outdated: boolean
}

export type ListinoPrezziInsertResult =
  | { ok: true; inserted: number; skipped: { prodotto: string; reason: 'document_date_before_latest' }[] }
  | { ok: false; error: string; skipped?: { prodotto: string; reason: 'document_date_before_latest' }[] }

/**
 * Inserisce righe in `listino_prezzi` rispettando la protezione data:
 * se `data_prezzo` è **anteriore** alla data massima già salvata per lo stesso `prodotto`
 * (equivalente a `data_ultimo_prezzo` del listino per quel nome), la riga viene **saltata**
 * salvo `force_outdated` con `canForceOutdated` true.
 */
export async function executeListinoPrezziInsert(
  service: SupabaseClient,
  fornitoreId: string,
  parsed: ParsedListinoInsertRow[],
  canForceOutdated: boolean,
): Promise<ListinoPrezziInsertResult> {
  if (parsed.length === 0) {
    return { ok: false, error: 'Nessuna riga valida (prodotto, prezzo, data)' }
  }

  const distinctProducts = [...new Set(parsed.map((p) => p.prodotto))]
  const { data: existingRows, error: exErr } = await service
    .from('listino_prezzi')
    .select('prodotto, data_prezzo')
    .eq('fornitore_id', fornitoreId)
    .in('prodotto', distinctProducts)

  if (exErr) return { ok: false, error: exErr.message }

  const maxByProduct = new Map<string, string>()
  for (const row of existingRows ?? []) {
    const p = String(row.prodotto).trim()
    const d = String(row.data_prezzo).slice(0, 10)
    const cur = maxByProduct.get(p)
    if (!cur || compareIsoDateStrings(d, cur) > 0) maxByProduct.set(p, d)
  }

  const skipped: { prodotto: string; reason: 'document_date_before_latest' }[] = []
  const toInsert: Array<{ fornitore_id: string; prodotto: string; prezzo: number; data_prezzo: string; note: string | null }> =
    []
  const workingMax = new Map(maxByProduct)

  for (const r of parsed) {
    const latest = workingMax.get(r.prodotto) ?? null
    const allowed = isDocumentDateAtLeastLatestListino(r.data_prezzo, latest)
    if (!allowed) {
      if (r.force_outdated) {
        if (!canForceOutdated) {
          return {
            ok: false,
            error: 'Override data antecedente non consentito per questo profilo.',
            skipped,
          }
        }
        toInsert.push({
          fornitore_id: r.fornitore_id,
          prodotto: r.prodotto,
          prezzo: r.prezzo,
          data_prezzo: r.data_prezzo,
          note: r.note,
        })
        const d = r.data_prezzo.slice(0, 10)
        const wm = workingMax.get(r.prodotto)
        if (!wm || compareIsoDateStrings(d, wm) > 0) workingMax.set(r.prodotto, d)
      } else {
        skipped.push({ prodotto: r.prodotto, reason: 'document_date_before_latest' })
      }
      continue
    }
    toInsert.push({
      fornitore_id: r.fornitore_id,
      prodotto: r.prodotto,
      prezzo: r.prezzo,
      data_prezzo: r.data_prezzo,
      note: r.note,
    })
    const d = r.data_prezzo.slice(0, 10)
    const wm = workingMax.get(r.prodotto)
    if (!wm || compareIsoDateStrings(d, wm) > 0) workingMax.set(r.prodotto, d)
  }

  if (toInsert.length === 0) {
    return {
      ok: false,
      error:
        'Nessuna riga inserita: la data documento è precedente all’ultimo aggiornamento listino per tutti i prodotti selezionati.',
      skipped,
    }
  }

  const { error } = await service.from('listino_prezzi').insert(toInsert)
  if (error) return { ok: false, error: error.message, skipped }

  return { ok: true, inserted: toInsert.length, skipped }
}
