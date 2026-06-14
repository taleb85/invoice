import type { SupabaseClient } from '@supabase/supabase-js'
import { compareIsoDateStrings, isDocumentDateAtLeastLatestListino } from '@/lib/listino-document-date'
import {
  listinoDocumentOriginLabel,
  listinoOriginNoteWithSrc,
} from '@/lib/listino-display'
import {
  existingListinoPricesForImport,
  normalizeListinoImportLineItem,
} from '@/lib/listino-invoice-line-normalize'
import { formatListinoVatNote } from '@/lib/listino-vat'
import {
  listinoImportApiBody,
  listinoImportTable,
  type ListinoImportDocTipo,
} from '@/lib/listino-import-document'

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

type PendingListinoDoc = {
  tipo: ListinoImportDocTipo
  id: string
  data: string
  numero: string | null
}

function pushPendingOrdini(
  pending: PendingListinoDoc[],
  rows: unknown[] | null,
): void {
  for (const o of rows ?? []) {
    const row = o as {
      id: string
      data_ordine: string | null
      created_at: string
      numero_ordine?: string | null
      titolo?: string | null
      analizzata?: boolean | null
    }
    if (row.analizzata) continue
    const data =
      row.data_ordine?.slice(0, 10) ??
      String(row.created_at ?? '').slice(0, 10) ??
      ''
    if (!data) continue
    pending.push({
      tipo: 'ordine',
      id: row.id,
      data,
      numero: row.numero_ordine?.trim() || row.titolo?.trim() || null,
    })
  }
}

async function pendingListinoDocsForFornitore(
  service: SupabaseClient,
  fornitoreId: string,
  maxDocs: number,
): Promise<PendingListinoDoc[]> {
  const [fattureRes, bolleRes, ordiniRes] = await Promise.all([
    service
      .from('fatture')
      .select('id, data, numero_fattura, file_url, analizzata')
      .eq('fornitore_id', fornitoreId)
      .not('file_url', 'is', null)
      .order('data', { ascending: false }),
    service
      .from('bolle')
      .select('id, data, numero_bolla, file_url, analizzata')
      .eq('fornitore_id', fornitoreId)
      .not('file_url', 'is', null)
      .order('data', { ascending: false }),
    service
      .from('conferme_ordine')
      .select('id, data_ordine, created_at, numero_ordine, titolo, file_url, analizzata')
      .eq('fornitore_id', fornitoreId)
      .not('file_url', 'is', null)
      .order('created_at', { ascending: false }),
  ])

  const pending: PendingListinoDoc[] = []

  for (const f of fattureRes.data ?? []) {
    const row = f as {
      id: string
      data: string
      numero_fattura: string | null
      analizzata?: boolean | null
    }
    if (row.analizzata) continue
    pending.push({
      tipo: 'fattura',
      id: row.id,
      data: row.data,
      numero: row.numero_fattura,
    })
  }

  for (const b of bolleRes.data ?? []) {
    const row = b as {
      id: string
      data: string
      numero_bolla: string | null
      analizzata?: boolean | null
    }
    if (row.analizzata) continue
    pending.push({
      tipo: 'bolla',
      id: row.id,
      data: row.data,
      numero: row.numero_bolla,
    })
  }

  if (!ordiniRes.error) {
    pushPendingOrdini(pending, ordiniRes.data)
  } else {
    const { data: fallback } = await service
      .from('conferme_ordine')
      .select('id, data_ordine, created_at, numero_ordine, titolo, file_url')
      .eq('fornitore_id', fornitoreId)
      .not('file_url', 'is', null)
      .order('created_at', { ascending: false })
    pushPendingOrdini(pending, fallback)
  }

  pending.sort((a, b) => compareIsoDateStrings(b.data, a.data))
  return pending.slice(0, maxDocs)
}

async function markDocAnalyzed(service: SupabaseClient, doc: PendingListinoDoc): Promise<void> {
  const { error } = await service
    .from(listinoImportTable(doc.tipo))
    .update({ analizzata: true })
    .eq('id', doc.id)
  if (error) throw error
}

export type SyncListinoFromFattureResult = {
  /** Documenti elaborati (fatture, bolle, ordini). */
  fattureScanned: number
  righeInserite: number
  skipped?: boolean
  reason?: string
  errors: string[]
}

/**
 * Importa prodotti e prezzi dai PDF di fatture, bolle e conferme ordine non ancora marcate `analizzata`.
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

  const docsToProcess = await pendingListinoDocsForFornitore(service, fornitoreId, maxFatture)

  if (docsToProcess.length === 0) {
    return { fattureScanned: 0, righeInserite: 0, errors }
  }

  const { data: listinoFresh } = await service
    .from('listino_prezzi')
    .select('prodotto, prezzo, data_prezzo, note')
    .eq('fornitore_id', fornitoreId)

  const listinoRows = (listinoFresh ?? []) as Array<{
    prodotto: string
    prezzo: number
    data_prezzo: string
    note?: string | null
  }>
  let listinoInserted = 0
  let docsScanned = 0

  for (const doc of docsToProcess) {
    const imp = await fetch(`${baseUrl}/api/listino/importa-da-fattura`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify(listinoImportApiBody(doc.tipo, doc.id)),
    })
    const json = (await imp.json().catch(() => ({}))) as {
      items?: Array<{
        prodotto: string
        prezzo: number
        codice_prodotto?: string | null
        quantita?: number | null
        importo_linea?: number | null
        unita: string | null
        aliquota_iva?: number | null
        note: string | null
      }>
      data_fattura?: string | null
    }
    if (!imp.ok || !Array.isArray(json.items) || json.items.length === 0) {
      await markDocAnalyzed(service, doc)
      docsScanned++
      continue
    }

    const docDate =
      String(json.data_fattura ?? doc.data ?? '').slice(0, 10) ||
      new Date().toISOString().split('T')[0]

    const products = new Set(json.items.map((i) => String(i.prodotto).trim()).filter(Boolean))
    const maxByProduct = maxDateForProducts(listinoRows, products)

    const rowsOut: Array<{
      prodotto: string
      prezzo: number
      data_prezzo: string
      note: string | null
    }> = []

    const originLabel = listinoDocumentOriginLabel(doc.tipo, doc.data, doc.numero)

    for (const item of json.items) {
      const hist = existingListinoPricesForImport(
        listinoRows,
        String(item.prodotto ?? '').trim(),
        item.codice_prodotto,
      )
      const normalized = normalizeListinoImportLineItem(
        {
          prodotto: String(item.prodotto ?? '').trim(),
          codice_prodotto: item.codice_prodotto ?? null,
          prezzo: item.prezzo,
          quantita: item.quantita ?? null,
          importo_linea: item.importo_linea ?? null,
          unita: item.unita,
          aliquota_iva: item.aliquota_iva ?? null,
          note: item.note,
        },
        hist,
      )
      const prodotto = normalized.prodotto.trim()
      if (!prodotto || typeof normalized.prezzo !== 'number' || normalized.prezzo <= 0) continue
      const latest = maxByProduct.get(prodotto) ?? null
      if (latest != null && !isDocumentDateAtLeastLatestListino(docDate, latest)) continue

      const baseNote = [
        normalized.codice_prodotto ? `Codice: ${normalized.codice_prodotto}` : null,
        normalized.unita ? `Unità: ${normalized.unita}` : null,
        normalized.quantita != null && normalized.quantita > 1
          ? `Qtà documento: ${normalized.quantita}`
          : null,
        formatListinoVatNote(item.aliquota_iva ?? null),
        normalized.note,
      ]
        .filter(Boolean)
        .join(' — ') || null
      const note = listinoOriginNoteWithSrc(baseNote, doc.tipo, doc.id, originLabel)

      rowsOut.push({ prodotto, prezzo: normalized.prezzo, data_prezzo: docDate, note })
    }

    if (rowsOut.length === 0) {
      await markDocAnalyzed(service, doc)
      docsScanned++
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
      await markDocAnalyzed(service, doc)
      for (const r of rowsOut) {
        const p = r.prodotto.trim()
        const d = r.data_prezzo.slice(0, 10)
        const cur = maxByProduct.get(p)
        if (!cur || compareIsoDateStrings(d, cur) > 0) maxByProduct.set(p, d)
        listinoRows.push({
          prodotto: p,
          prezzo: r.prezzo,
          data_prezzo: d,
          note: r.note,
        })
      }
    } else {
      errors.push(
        `Listino salvataggio ${doc.tipo} ${doc.id}: ${saveJson.error ?? save.status}`,
      )
    }
    docsScanned++
  }

  return {
    fattureScanned: docsScanned,
    righeInserite: listinoInserted,
    errors,
  }
}
