import type { SupabaseClient } from '@supabase/supabase-js'
import { compareIsoDateStrings, isDocumentDateAtLeastLatestListino } from '@/lib/listino-document-date'
import { LISTINO_SRC_FATTURA_MARK } from '@/lib/listino-display'

function maxDateForProducts(
  rows: Array<{ prodotto: string; data_prezzo: string }>,
  products: Set<string>,
): Map<string, string> {
  const m = new Map<string, string>()
  for (const row of rows) {
    const p = String(row.prodotto).trim()
    if (!products.has(p)) continue
    const d = String(row.data_prezzo).slice(0, 10)
    const cur = m.get(p)
    if (!cur || compareIsoDateStrings(d, cur) > 0) m.set(p, d)
  }
  return m
}

export type SyncListinoFromFattureResult = {
  fattureScanned: number
  righeInserite: number
  skipped?: boolean
  reason?: string
  errors: string[]
}

/**
 * Importa prodotti e prezzi dal PDF delle fatture non ancora marcate `analizzata`.
 * Stessa logica della scheda fornitore / `analisi-completa` (solo listino).
 */
export async function syncListinoFromFattureForFornitore(
  service: SupabaseClient,
  opts: {
    fornitoreId: string
    baseUrl: string
    cookie: string
    maxFatture?: number
  },
): Promise<SyncListinoFromFattureResult> {
  const { fornitoreId, baseUrl, cookie, maxFatture = 40 } = opts
  const errors: string[] = []

  if (!process.env.GEMINI_API_KEY) {
    return {
      fattureScanned: 0,
      righeInserite: 0,
      skipped: true,
      reason: 'GEMINI_API_KEY non configurata',
      errors,
    }
  }

  const { data: fattureData } = await service
    .from('fatture')
    .select('id, data, numero_fattura, file_url, analizzata')
    .eq('fornitore_id', fornitoreId)
    .not('file_url', 'is', null)
    .order('data', { ascending: false })

  const fattureToProcess = (fattureData ?? [])
    .filter((f: { analizzata?: boolean | null }) => !f.analizzata)
    .slice(0, maxFatture) as {
    id: string
    data: string
    numero_fattura: string | null
    file_url: string | null
  }[]

  if (fattureToProcess.length === 0) {
    return { fattureScanned: 0, righeInserite: 0, errors }
  }

  const { data: listinoFresh } = await service
    .from('listino_prezzi')
    .select('prodotto, data_prezzo')
    .eq('fornitore_id', fornitoreId)

  const listinoRows = (listinoFresh ?? []) as Array<{ prodotto: string; data_prezzo: string }>
  let listinoInserted = 0
  let listinoFattureScanned = 0

  for (const fattura of fattureToProcess) {
    const imp = await fetch(`${baseUrl}/api/listino/importa-da-fattura`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ fattura_id: fattura.id }),
    })
    const json = (await imp.json().catch(() => ({}))) as {
      items?: Array<{
        prodotto: string
        prezzo: number
        codice_prodotto?: string | null
        unita: string | null
        note: string | null
      }>
      data_fattura?: string | null
    }
    if (!imp.ok || !Array.isArray(json.items) || json.items.length === 0) {
      await service.from('fatture').update({ analizzata: true }).eq('id', fattura.id)
      listinoFattureScanned++
      continue
    }

    const docDate =
      String(json.data_fattura ?? fattura.data ?? '').slice(0, 10) ||
      new Date().toISOString().split('T')[0]

    const products = new Set(json.items.map((i) => String(i.prodotto).trim()).filter(Boolean))
    const maxByProduct = maxDateForProducts(listinoRows, products)

    const rowsOut: Array<{
      prodotto: string
      prezzo: number
      data_prezzo: string
      note: string | null
    }> = []

    const fatturaLabel = fattura.numero_fattura
      ? `Fattura ${fattura.numero_fattura} — ${fattura.data}`
      : `Fattura · ${fattura.data}`

    for (const item of json.items) {
      const prodotto = String(item.prodotto ?? '').trim()
      if (!prodotto || typeof item.prezzo !== 'number' || item.prezzo <= 0) continue
      const latest = maxByProduct.get(prodotto) ?? null
      if (latest != null && !isDocumentDateAtLeastLatestListino(docDate, latest)) continue

      const baseNote = [
        item.codice_prodotto ? `Codice: ${item.codice_prodotto}` : null,
        item.unita ? `Unità: ${item.unita}` : null,
        item.note,
      ]
        .filter(Boolean)
        .join(' — ') || null
      const note = baseNote
        ? `${baseNote} — Origine: ${fatturaLabel}${LISTINO_SRC_FATTURA_MARK}${fattura.id}|`
        : `Origine listino — Origine: ${fatturaLabel}${LISTINO_SRC_FATTURA_MARK}${fattura.id}|`

      rowsOut.push({ prodotto, prezzo: item.prezzo, data_prezzo: docDate, note })
    }

    if (rowsOut.length === 0) {
      await service.from('fatture').update({ analizzata: true }).eq('id', fattura.id)
      listinoFattureScanned++
      continue
    }

    const save = await fetch(`${baseUrl}/api/listino/prezzi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ fornitore_id: fornitoreId, rows: rowsOut }),
    })
    const saveJson = (await save.json().catch(() => ({}))) as { inserted?: number; error?: string }
    if (save.ok) {
      listinoInserted += saveJson.inserted ?? rowsOut.length
      await service.from('fatture').update({ analizzata: true }).eq('id', fattura.id)
      for (const r of rowsOut) {
        const p = r.prodotto.trim()
        const d = r.data_prezzo.slice(0, 10)
        const cur = maxByProduct.get(p)
        if (!cur || compareIsoDateStrings(d, cur) > 0) maxByProduct.set(p, d)
        listinoRows.push({ prodotto: p, data_prezzo: d })
      }
    } else {
      errors.push(
        `Listino salvataggio fattura ${fattura.id}: ${saveJson.error ?? save.status}`,
      )
    }
    listinoFattureScanned++
  }

  return {
    fattureScanned: listinoFattureScanned,
    righeInserite: listinoInserted,
    errors,
  }
}
