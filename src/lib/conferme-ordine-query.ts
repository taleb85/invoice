import type { SupabaseClient } from '@supabase/supabase-js'
import {
  confermeOrdineBelongsToFornitore,
  type FornitoreNameRow,
} from '@/lib/conferme-ordine-fornitore-match'
import { confermeOrdineLedgerPeriodOrFilter } from '@/lib/documenti-queue-period'
import { numeroFatturaFromDocMetadata } from '@/lib/fattura-duplicate-check'

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

  let q = service
    .from('conferme_ordine')
    .select(
      'id, file_url, file_name, titolo, numero_ordine, data_ordine, note, created_at, righe, fornitore_id',
    )
    .eq('fornitore_id', fornitoreId)
    .order('created_at', { ascending: false })
    .limit(500)

  if (from && toExclusive) {
    q = q.or(confermeOrdineLedgerPeriodOrFilter(from, toExclusive))
  }

  const { data, error } = await q
  if (error) throw new Error(error.message)

  const raw = (data ?? []) as ConfermaOrdineListRow[]
  if (raw.length === 0) return { rows: [], sedeFornitori }

  const urls = [...new Set(raw.map((r) => r.file_url).filter(Boolean))]
  const ragioneByUrl = new Map<string, string>()
  const numeroFatturaByUrl = new Map<string, string>()
  const oggettoByUrl = new Map<string, string>()
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
    }
  }

  const rows = raw
    .filter((r) =>
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
    .map((r) => ({
      ...r,
      numero_ordine: r.numero_ordine ?? null,
      numero_fattura_doc: numeroFatturaByUrl.get(r.file_url) ?? null,
      oggetto_mail: oggettoByUrl.get(r.file_url) ?? null,
    }))

  return { rows, sedeFornitori }
}
