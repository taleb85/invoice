import type { SupabaseClient } from '@supabase/supabase-js'
import { utcBoundsForZonedCalendarDay } from '@/lib/zoned-day-bounds'
import { openDocumentUrl } from '@/lib/open-document-url'

export type EmailActivityTipoKey = 'invoice' | 'ddt' | 'statement' | 'queue' | 'ordine'

export type EmailActivityRow = {
  /** ISO per ordinamento */
  atIso: string
  tipoLabelKey: EmailActivityTipoKey
  fornitoreNome: string
  importo: number | null
  statusKey: 'saved' | 'needs_supplier' | 'ignored'
  href: string | null
}

function joinNome(fornitore: unknown): string | null {
  if (Array.isArray(fornitore)) {
    const n = (fornitore[0] as { nome?: string } | undefined)?.nome
    return typeof n === 'string' && n.trim() ? n.trim() : null
  }
  if (fornitore && typeof fornitore === 'object') {
    const n = (fornitore as { nome?: string }).nome
    return typeof n === 'string' && n.trim() ? n.trim() : null
  }
  return null
}

function metaRagioneSociale(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return ''
  const r = (metadata as { ragione_sociale?: string | null }).ragione_sociale
  return typeof r === 'string' && r.trim() ? r.trim() : ''
}

function tipoFromDoc(isStatement: boolean, metadata: unknown): EmailActivityTipoKey {
  if (isStatement) return 'statement'
  const m =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as { pending_kind?: string | null })
      : null
  const pk = m?.pending_kind
  if (pk === 'statement') return 'statement'
  if (pk === 'bolla') return 'ddt'
  if (pk === 'fattura') return 'invoice'
  if (pk === 'ordine') return 'ordine'
  return 'queue'
}

function sedeVisibleForRow(
  sedeId: string | null,
  scopeId: string | null,
  masterSeesAllSedi: boolean,
): boolean {
  if (masterSeesAllSedi) return true
  if (!scopeId) return true
  if (sedeId === null) return true
  return sedeId === scopeId
}

export type LoadEmailActivityClients = {
  /** Client utente (RLS) per fatture/bolle */
  user: SupabaseClient
  /** Service role per documenti (anche con sede_id NULL) */
  service: SupabaseClient
  timeZone: string
  sedeScopeId: string | null
  masterSeesAllSedi: boolean
}

/**
 * Vista “Attività email”: auto-save oggi (fattura/bolla) + voci coda rilevanti
 * (fornitore da aggiungere, ignorato) senza messaggi tecnici.
 */
export async function loadEmailActivityDayRows(opts: LoadEmailActivityClients): Promise<EmailActivityRow[]> {
  const tz = opts.timeZone.trim() || 'UTC'
  const { start, endExclusive } = utcBoundsForZonedCalendarDay(tz)
  const rows: EmailActivityRow[] = []

  let fattureQ = opts.user
    .from('fatture')
    .select('id, importo, email_sync_auto_saved_at, fornitore:fornitori(nome)')
    .gte('email_sync_auto_saved_at', start)
    .lt('email_sync_auto_saved_at', endExclusive)
    .not('email_sync_auto_saved_at', 'is', null)

  let bolleQ = opts.user
    .from('bolle')
    .select('id, importo, email_sync_auto_saved_at, fornitore:fornitori(nome)')
    .gte('email_sync_auto_saved_at', start)
    .lt('email_sync_auto_saved_at', endExclusive)
    .not('email_sync_auto_saved_at', 'is', null)

  if (!opts.masterSeesAllSedi && opts.sedeScopeId) {
    fattureQ = fattureQ.eq('sede_id', opts.sedeScopeId)
    bolleQ = bolleQ.eq('sede_id', opts.sedeScopeId)
  }

  const [fattureRes, bolleRes] = await Promise.all([fattureQ, bolleQ])

  for (const f of fattureRes.data ?? []) {
    const iso = String((f as { email_sync_auto_saved_at?: string }).email_sync_auto_saved_at ?? '')
    rows.push({
      atIso: iso,
      tipoLabelKey: 'invoice',
      fornitoreNome: joinNome((f as { fornitore?: unknown }).fornitore) ?? '—',
      importo: (f as { importo?: number | null }).importo ?? null,
      statusKey: 'saved',
      href: openDocumentUrl({ fatturaId: String((f as { id?: string }).id) }),
    })
  }

  for (const b of bolleRes.data ?? []) {
    const iso = String((b as { email_sync_auto_saved_at?: string }).email_sync_auto_saved_at ?? '')
    rows.push({
      atIso: iso,
      tipoLabelKey: 'ddt',
      fornitoreNome: joinNome((b as { fornitore?: unknown }).fornitore) ?? '—',
      importo: (b as { importo?: number | null }).importo ?? null,
      statusKey: 'saved',
      href: openDocumentUrl({ bollaId: String((b as { id?: string }).id) }),
    })
  }

  const docQ = opts.service
    .from('documenti_da_processare')
    .select('id, created_at, stato, metadata, mittente, is_statement, sede_id, fornitore:fornitori(nome)')
    .gte('created_at', start)
    .lt('created_at', endExclusive)
    .or('and(fornitore_id.is.null,stato.in.(da_revisionare,da_associare)),stato.eq.scartato')

  const { data: docRows, error: docErr } = await docQ
  if (docErr) {
    console.error('[email-activity-day] documenti query', docErr.message)
  }

  for (const d of docRows ?? []) {
    const sedeId = (d as { sede_id?: string | null }).sede_id ?? null
    if (!sedeVisibleForRow(sedeId, opts.sedeScopeId, opts.masterSeesAllSedi)) continue

    const iso = String((d as { created_at?: string }).created_at ?? '')
    const stato = String((d as { stato?: string }).stato ?? '')
    const meta = (d as { metadata?: unknown }).metadata
    const isStatement = !!(d as { is_statement?: boolean }).is_statement
    const nomeForn = joinNome((d as { fornitore?: unknown }).fornitore)
    const nome = nomeForn ?? metaRagioneSociale(meta)
    const mitt = String((d as { mittente?: string | null }).mittente ?? '').trim()
    const displayNome = nome || mitt || '—'

    const tot =
      meta && typeof meta === 'object'
        ? (meta as { totale_iva_inclusa?: number | null }).totale_iva_inclusa
        : null
    const importo = typeof tot === 'number' && Number.isFinite(tot) ? tot : null

    const tipoLabelKey = tipoFromDoc(isStatement, meta)

    if (stato === 'scartato') {
      rows.push({
        atIso: iso,
        tipoLabelKey,
        fornitoreNome: displayNome,
        importo,
        statusKey: 'ignored',
        href: openDocumentUrl({ documentoId: String((d as { id?: string }).id) }),
      })
      continue
    }

    rows.push({
      atIso: iso,
      tipoLabelKey,
      fornitoreNome: displayNome,
      importo,
      statusKey: 'needs_supplier',
      href: openDocumentUrl({ documentoId: String((d as { id?: string }).id) }),
    })
  }

  rows.sort((a, b) => (a.atIso < b.atIso ? 1 : a.atIso > b.atIso ? -1 : 0))
  return rows
}

export function countAutoSavedTodayFromRows(rows: EmailActivityRow[]): number {
  return rows.filter((r) => r.statusKey === 'saved').length
}
