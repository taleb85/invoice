import type { SupabaseClient } from '@supabase/supabase-js'
import {
  confermeOrdineBelongsToFornitore,
  type FornitoreNameRow,
} from '@/lib/conferme-ordine-fornitore-match'
import { confermeOrdineLedgerPeriodOrFilter } from '@/lib/documenti-queue-period'
import { numeroFatturaFromDocMetadata } from '@/lib/fattura-duplicate-check'
import { isConfermeOrdineMissingNumeroOrdineColumn } from '@/lib/conferme-ordine-schema'
import { downloadStorageObjectByFileUrl } from '@/lib/documenti-storage-url'
import { extractDocumentText } from '@/lib/document-extractors'
import { extractOrderDateFromLabelledText, orderDateYmdFromOcr, safeDate } from '@/lib/safe-date'

const PDF_ORDER_DATE_EXTRACT_LIMIT = 24

const CONFERME_ORDINE_SELECT_BASE =
  'id, file_url, file_name, titolo, data_ordine, note, created_at, righe, fornitore_id'
const CONFERME_ORDINE_SELECT_WITH_NUMERO = `${CONFERME_ORDINE_SELECT_BASE}, numero_ordine`

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

function orderDateYmdFromDocMetadata(metadata: unknown): string | null {
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

  let { data, error } = await buildQuery(CONFERME_ORDINE_SELECT_WITH_NUMERO)
  if (error && isConfermeOrdineMissingNumeroOrdineColumn(error)) {
    ;({ data, error } = await buildQuery(CONFERME_ORDINE_SELECT_BASE))
  }
  if (error) throw new Error(error.message)

  const raw = (data ?? []).map((r) => ({
    ...(r as Omit<ConfermaOrdineListRow, 'numero_ordine' | 'numero_fattura_doc' | 'oggetto_mail'>),
    numero_ordine: (r as ConfermaOrdineListRow).numero_ordine ?? null,
  })) as ConfermaOrdineListRow[]
  if (raw.length === 0) return { rows: [], sedeFornitori }

  const urls = [...new Set(raw.map((r) => r.file_url).filter(Boolean))]
  const ragioneByUrl = new Map<string, string>()
  const numeroFatturaByUrl = new Map<string, string>()
  const oggettoByUrl = new Map<string, string>()
  const orderDateByUrl = new Map<string, string>()
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

    if (
      !fromMeta &&
      pdfExtracts < PDF_ORDER_DATE_EXTRACT_LIMIT &&
      /order\s+confirmation/i.test(r.file_name ?? '')
    ) {
      const fromPdf = await tryOrderDateFromConfermaPdf(service, r.file_url)
      if (fromPdf) {
        display = fromPdf
      }
      pdfExtracts++
    }

    rows.push({
      ...r,
      numero_ordine: r.numero_ordine ?? null,
      numero_fattura_doc: numeroFatturaByUrl.get(r.file_url) ?? null,
      oggetto_mail: oggettoByUrl.get(r.file_url) ?? null,
      data_ordine_display: display,
    })
  }

  return { rows: sortConfermeOrdineByDocumentDateDesc(rows), sedeFornitori }
}

async function tryOrderDateFromConfermaPdf(
  service: SupabaseClient,
  fileUrl: string,
): Promise<string | null> {
  try {
    const dl = await downloadStorageObjectByFileUrl(service, fileUrl)
    if ('error' in dl) return null
    const contentType = dl.contentType?.trim() || 'application/pdf'
    const { text } = await extractDocumentText(dl.data, contentType)
    return extractOrderDateFromLabelledText(text ?? '')
  } catch {
    return null
  }
}
