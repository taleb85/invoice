import type { SupabaseClient } from '@supabase/supabase-js'
import {
  confermeOrdineBelongsToFornitore,
  type FornitoreNameRow,
} from '@/lib/conferme-ordine-fornitore-match'
import { confermeOrdineLedgerPeriodOrFilter } from '@/lib/documenti-queue-period'
import { numeroFatturaFromDocMetadata } from '@/lib/fattura-duplicate-check'
import {
  isConfermeOrdineMissingImportoTotaleColumn,
  isConfermeOrdineMissingNumeroOrdineColumn,
} from '@/lib/conferme-ordine-schema'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { extractDocumentText } from '@/lib/document-extractors'
import {
  extractOrderTotalFromLabelledText,
  totaleFromDocMetadata,
} from '@/lib/conferme-ordine-importo'
import { extractOrderDateFromLabelledText, orderDateYmdFromOcr, safeDate } from '@/lib/safe-date'
import type { OrdineDupListRow } from '@/lib/check-duplicates'

const PDF_ORDER_DATE_EXTRACT_LIMIT = 24

const CONFERME_ORDINE_SELECT_BASE =
  'id, file_url, file_name, titolo, data_ordine, note, created_at, righe, fornitore_id'
const CONFERME_ORDINE_SELECT_WITH_NUMERO = `${CONFERME_ORDINE_SELECT_BASE}, numero_ordine`
const CONFERME_ORDINE_SELECT_FULL = `${CONFERME_ORDINE_SELECT_WITH_NUMERO}, importo_totale`

export type ConfermaOrdineListRow = {
  id: string
  file_url: string
  file_name: string | null
  titolo: string | null
  numero_ordine: string | null
  /** Numero ordine da metadata OCR della coda (stesso `file_url`). */
  numero_fattura_doc: string | null
  oggetto_mail: string | null
  data_ordine: string | null
  note: string | null
  created_at: string
  righe: unknown
  fornitore_id: string
  /** Data ordine da mostrare (metadata OCR «Order Date» se presente, altrimenti colonna DB). */
  data_ordine_display: string | null
  /** Totale documento da OCR in coda (se non calcolabile dalle righe Rekki). */
  importo_totale: number | null
}

/** Giorno per ordinamento elenco: data documento (display/OCR o DB), poi ricezione. */
export function confermaOrdineSortDayIso(row: Pick<ConfermaOrdineListRow, 'data_ordine_display' | 'data_ordine' | 'created_at'>): string {
  const display = row.data_ordine_display?.trim()
  if (display && /^\d{4}-\d{2}-\d{2}$/.test(display)) return display
  const col = row.data_ordine ? safeDate(row.data_ordine) : null
  if (col) return col
  const recv = row.created_at?.trim()
  if (recv && /^\d{4}-\d{2}-\d{2}/.test(recv)) return recv.slice(0, 10)
  return ''
}

/** Conferme in tab fornitore: data documento decrescente (come fatture/bolle). */
/** Mappa riga elenco → probe duplicati (numero da filename/OCR, data display). */
export function confermaOrdineRowToOrdineDupProbe(row: ConfermaOrdineListRow): OrdineDupListRow {
  const day = confermaOrdineSortDayIso(row)
  const dataOrdine =
    row.data_ordine_display && /^\d{4}-\d{2}-\d{2}$/.test(row.data_ordine_display.trim())
      ? row.data_ordine_display.trim().slice(0, 10)
      : day || row.data_ordine
  return {
    id: row.id,
    fornitore_id: row.fornitore_id,
    data_ordine: dataOrdine,
    numero_ordine: row.numero_ordine,
    titolo: row.titolo,
    created_at: row.created_at,
    file_url: row.file_url,
    file_name: row.file_name,
    numero_fattura_doc: row.numero_fattura_doc,
    oggetto_mail: row.oggetto_mail,
  }
}

export function sortConfermeOrdineByDocumentDateDesc(rows: ConfermaOrdineListRow[]): ConfermaOrdineListRow[] {
  return [...rows].sort((a, b) => {
    const dayCmp = confermaOrdineSortDayIso(b).localeCompare(confermaOrdineSortDayIso(a))
    if (dayCmp !== 0) return dayCmp
    return (b.created_at ?? '').localeCompare(a.created_at ?? '')
  })
}

export async function loadSedeFornitoriForMatch(
  service: SupabaseClient,
  fornitoreId: string,
): Promise<FornitoreNameRow[]> {
  const { data: fornitoreRow } = await service
    .from('fornitori')
    .select('sede_id, nome, display_name')
    .eq('id', fornitoreId)
    .maybeSingle()

  if (!fornitoreRow) return []

  if (fornitoreRow.sede_id) {
    const { data: peerRows } = await service
      .from('fornitori')
      .select('id, nome, display_name')
      .eq('sede_id', fornitoreRow.sede_id)
    return (peerRows ?? []) as FornitoreNameRow[]
  }

  return [
    {
      id: fornitoreId,
      nome: fornitoreRow.nome,
      display_name: fornitoreRow.display_name,
    },
  ]
}

export function orderDateYmdFromDocMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const m = metadata as { data_ordine?: unknown; data_fattura?: unknown; pending_kind?: unknown }
  if (m.pending_kind != null && m.pending_kind !== 'ordine') return null
  return orderDateYmdFromOcr({
    data_ordine: typeof m.data_ordine === 'string' ? m.data_ordine : null,
    data_fattura: typeof m.data_fattura === 'string' ? m.data_fattura : null,
  })
}

function ragioneSocialeFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const rs = (metadata as { ragione_sociale?: unknown }).ragione_sociale
  return typeof rs === 'string' && rs.trim() ? rs.trim() : null
}

/** Arricchisce righe duplicati ordini con data/oggetto da `documenti_da_processare` (stesso `file_url`). */
export async function enrichOrdiniDupRowsFromDocumenti(
  supabase: SupabaseClient,
  rows: OrdineDupListRow[],
): Promise<OrdineDupListRow[]> {
  const urls = [...new Set(rows.map((r) => r.file_url?.trim()).filter(Boolean))] as string[]
  if (urls.length === 0) return rows

  const metaByUrl = new Map<
    string,
    { date: string | null; oggetto: string | null }
  >()
  const chunk = 100
  for (let i = 0; i < urls.length; i += chunk) {
    const slice = urls.slice(i, i + chunk)
    const { data } = await supabase
      .from('documenti_da_processare')
      .select('file_url, metadata, oggetto_mail')
      .in('file_url', slice)
    for (const d of data ?? []) {
      const url = (d as { file_url?: string }).file_url?.trim()
      if (!url) continue
      const meta = (d as { metadata?: unknown }).metadata
      const oggetto = (d as { oggetto_mail?: string | null }).oggetto_mail
      metaByUrl.set(url, {
        date: orderDateYmdFromDocMetadata(meta),
        oggetto: typeof oggetto === 'string' && oggetto.trim() ? oggetto.trim() : null,
      })
    }
  }

  return rows.map((r) => {
    const u = r.file_url?.trim()
    const m = u ? metaByUrl.get(u) : undefined
    const colDate = r.data_ordine ? safeDate(r.data_ordine) : null
    return {
      ...r,
      data_ordine: m?.date ?? colDate ?? r.data_ordine,
      oggetto_mail: r.oggetto_mail ?? m?.oggetto ?? null,
    }
  })
}

/** Conferme ordine del fornitore nel periodo, filtrate sul nome fornitore nel documento. */
export async function fetchFilteredConfermeOrdine(
  service: SupabaseClient,
  opts: {
    fornitoreId: string
    from?: string
    toExclusive?: string
  },
): Promise<{ rows: ConfermaOrdineListRow[]; sedeFornitori: FornitoreNameRow[] }> {
  const { fornitoreId, from, toExclusive } = opts
  const sedeFornitori = await loadSedeFornitoriForMatch(service, fornitoreId)

  function buildQuery(select: string) {
    let q = service
      .from('conferme_ordine')
      .select(select)
      .eq('fornitore_id', fornitoreId)
      .order('created_at', { ascending: false })
      .limit(500)
    if (from && toExclusive) {
      q = q.or(confermeOrdineLedgerPeriodOrFilter(from, toExclusive))
    }
    return q
  }

  let { data, error } = await buildQuery(CONFERME_ORDINE_SELECT_FULL)
  if (error && isConfermeOrdineMissingImportoTotaleColumn(error)) {
    ;({ data, error } = await buildQuery(CONFERME_ORDINE_SELECT_WITH_NUMERO))
  }
  if (error && isConfermeOrdineMissingNumeroOrdineColumn(error)) {
    ;({ data, error } = await buildQuery(CONFERME_ORDINE_SELECT_BASE))
  }
  if (error) throw new Error(error.message)

  const raw = (data ?? []).map((r) => {
    const row = r as unknown as ConfermaOrdineListRow & { importo_totale?: number | null }
    return {
      ...(row as Omit<ConfermaOrdineListRow, 'numero_ordine' | 'numero_fattura_doc' | 'oggetto_mail'>),
      numero_ordine: row.numero_ordine ?? null,
      importo_totale:
        typeof row.importo_totale === 'number' && Number.isFinite(row.importo_totale)
          ? row.importo_totale
          : null,
    }
  }) as ConfermaOrdineListRow[]
  if (raw.length === 0) return { rows: [], sedeFornitori }

  const urls = [...new Set(raw.map((r) => r.file_url).filter(Boolean))]
  const ragioneByUrl = new Map<string, string>()
  const numeroFatturaByUrl = new Map<string, string>()
  const oggettoByUrl = new Map<string, string>()
  const orderDateByUrl = new Map<string, string>()
  const importoByUrl = new Map<string, number>()
  if (urls.length > 0) {
    const { data: docs } = await service
      .from('documenti_da_processare')
      .select('file_url, metadata, oggetto_mail')
      .in('file_url', urls)
    for (const d of docs ?? []) {
      const url = (d as { file_url?: string }).file_url
      if (!url) continue
      const meta = (d as { metadata?: unknown }).metadata
      const rs = ragioneSocialeFromMetadata(meta)
      if (rs) ragioneByUrl.set(url, rs)
      const num = numeroFatturaFromDocMetadata(meta)
      if (num) numeroFatturaByUrl.set(url, num)
      const oggetto = (d as { oggetto_mail?: string | null }).oggetto_mail
      if (typeof oggetto === 'string' && oggetto.trim()) oggettoByUrl.set(url, oggetto.trim())
      const orderYmd = orderDateYmdFromDocMetadata(meta)
      if (orderYmd) orderDateByUrl.set(url, orderYmd)
      const tot = totaleFromDocMetadata(meta)
      if (tot != null) importoByUrl.set(url, tot)
    }
  }

  const filtered = raw.filter((r) =>
    confermeOrdineBelongsToFornitore(
      {
        titolo: r.titolo,
        file_name: r.file_name,
        ragione_sociale: ragioneByUrl.get(r.file_url) ?? null,
        fornitore_id: r.fornitore_id,
      },
      fornitoreId,
      sedeFornitori,
    ),
  )

  let pdfExtracts = 0
  const rows: ConfermaOrdineListRow[] = []
  for (const r of filtered) {
    const fromMeta = orderDateByUrl.get(r.file_url) ?? null
    const fromDb = r.data_ordine ? safeDate(r.data_ordine) : null
    let display = fromMeta ?? fromDb
    let importo =
      (typeof r.importo_totale === 'number' && Number.isFinite(r.importo_totale)
        ? r.importo_totale
        : null) ??
      importoByUrl.get(r.file_url) ??
      null

    const needsPdfExtract =
      pdfExtracts < PDF_ORDER_DATE_EXTRACT_LIMIT &&
      /order\s+confirmation|sales\s+order/i.test(r.file_name ?? '')

    if (needsPdfExtract) {
      const pdfFields = await tryOrderFieldsFromConfermaPdf(service, r.file_url)
      if (!fromMeta && pdfFields.orderDate) {
        display = pdfFields.orderDate
      }
      if (importo == null && pdfFields.importoTotale != null) {
        importo = pdfFields.importoTotale
      }
      pdfExtracts++
    }

    rows.push({
      ...r,
      numero_ordine: r.numero_ordine ?? null,
      numero_fattura_doc: numeroFatturaByUrl.get(r.file_url) ?? null,
      oggetto_mail: oggettoByUrl.get(r.file_url) ?? null,
      data_ordine_display: display,
      importo_totale: importo,
    })
  }

  return { rows: sortConfermeOrdineByDocumentDateDesc(rows), sedeFornitori }
}

async function tryOrderFieldsFromConfermaPdf(
  service: SupabaseClient,
  fileUrl: string,
): Promise<{ orderDate: string | null; importoTotale: number | null }> {
  try {
    const dl = await downloadStorageObjectByFileUrl(service, fileUrl)
    if ('error' in dl) return { orderDate: null, importoTotale: null }
    const contentType = dl.contentType?.trim() || 'application/pdf'
    const { text } = await extractDocumentText(dl.data, contentType)
    const body = text ?? ''
    return {
      orderDate: extractOrderDateFromLabelledText(body),
      importoTotale: extractOrderTotalFromLabelledText(body),
    }
  } catch {
    return { orderDate: null, importoTotale: null }
  }
}
