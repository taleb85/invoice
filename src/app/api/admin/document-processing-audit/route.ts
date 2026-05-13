import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'
import { logger } from '@/lib/logger'
import {
  DOCUMENTI_DA_PROCESSARE_STATI,
} from '@/lib/documenti-queue-stato'

export const dynamic = 'force-dynamic'

const STUCK_DAYS_THRESHOLD = 7

type StatoCount = {
  stato: string
  count: number
}

type StuckDocument = {
  id: string
  stato: string
  created_at: string | null
  giorni_in_stato: number
  mittente: string | null
  file_name: string | null
  file_url: string | null
  pending_kind: string | null
}

type StatementIssue = {
  id: string
  fornitore_id: string | null
  file_url: string | null
  missing_rows: number | null
  created_at: string | null
}

type SyncError = {
  id: string
  data: string | null
  stato: string
  sede_id: string | null
  message?: string | null
}

type AuditResult = {
  riepilogo: {
    totale: number
    per_stato: StatoCount[]
  }
  documenti_bloccati: StuckDocument[]
  documenti_da_revisionare: StuckDocument[]
  statement_con_problemi: StatementIssue[]
  errori_sincronizzazione_recenti: SyncError[]
  statistiche: {
    tasso_completamento: number
    totale_bloccati: number
    totale_da_revisionare: number
    totale_statement_issues: number
    totale_errori_sincro: number
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { searchParams } = new URL(req.url)
    const sedeId = searchParams.get('sede_id')

    const oggi = new Date()
    const sogliaStuck = new Date(oggi.getTime() - STUCK_DAYS_THRESHOLD * 24 * 60 * 60 * 1000).toISOString()
    const errori24h = new Date(oggi.getTime() - 24 * 60 * 60 * 1000).toISOString()

    let baseQuery = supabase.from('documenti_da_processare').select('*', { count: 'exact', head: true })
    if (sedeId) baseQuery = baseQuery.or(`sede_id.eq.${sedeId},sede_id.is.null`)

    const [{ count: totale }, ...statoCounts] = await Promise.all([
      baseQuery,
      ...DOCUMENTI_DA_PROCESSARE_STATI.map((stato) =>
        (() => {
          let q = supabase
            .from('documenti_da_processare')
            .select('*', { count: 'exact', head: true })
            .eq('stato', stato)
          if (sedeId) q = q.or(`sede_id.eq.${sedeId},sede_id.is.null`)
          return q.then((r) => ({ stato, count: r.count ?? 0 } as StatoCount))
        })()
      ),
    ])

    const nonTerminali = ['da_processare', 'da_associare', 'bozza_creata', 'da_revisionare']
    let stuckQ = supabase
      .from('documenti_da_processare')
      .select('id, stato, created_at, mittente, file_name, file_url, metadata')
      .in('stato', nonTerminali)
      .lt('created_at', sogliaStuck)
      .order('created_at', { ascending: false })
      .limit(100)
    if (sedeId) stuckQ = stuckQ.or(`sede_id.eq.${sedeId},sede_id.is.null`)
    const { data: stuckRaw, error: stuckErr } = await stuckQ

    let daRevQ = supabase
      .from('documenti_da_processare')
      .select('id, stato, created_at, mittente, file_name, file_url, metadata')
      .eq('stato', 'da_revisionare')
      .order('created_at', { ascending: false })
      .limit(100)
    if (sedeId) daRevQ = daRevQ.or(`sede_id.eq.${sedeId},sede_id.is.null`)
    const { data: daRevRaw, error: daRevErr } = await daRevQ

    const [statementsWithIssuesRes, syncErrorsRes] = await Promise.all([
      (() => {
        let q = supabase
          .from('statements')
          .select('id, fornitore_id, file_url, missing_rows, created_at')
          .gt('missing_rows', 0)
          .order('created_at', { ascending: false })
          .limit(50)
        if (sedeId) q = q.eq('sede_id', sedeId)
        return q
      })(),
      (() => {
        let q = supabase
          .from('log_sincronizzazione')
          .select('id, data, stato, sede_id, message')
          .in('stato', ['fornitore_non_trovato', 'bolla_non_trovata'])
          .gte('data', errori24h)
          .order('data', { ascending: false })
          .limit(50)
        if (sedeId) q = q.eq('sede_id', sedeId)
        return q
      })(),
    ])

    const stuckDocuments: StuckDocument[] = (stuckRaw ?? []).map((r) => {
      const created = r.created_at ? new Date(r.created_at) : null
      const giorni = created ? Math.floor((oggi.getTime() - created.getTime()) / (24 * 60 * 60 * 1000)) : 0
      const meta = r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : null
      return {
        id: r.id,
        stato: r.stato,
        created_at: r.created_at,
        giorni_in_stato: giorni,
        mittente: r.mittente,
        file_name: r.file_name,
        file_url: r.file_url,
        pending_kind: (meta?.pending_kind as string | null) ?? null,
      }
    })

    const daRevisionare: StuckDocument[] = (daRevRaw ?? []).map((r) => {
      const created = r.created_at ? new Date(r.created_at) : null
      const giorni = created ? Math.floor((oggi.getTime() - created.getTime()) / (24 * 60 * 60 * 1000)) : 0
      const meta = r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)
        ? (r.metadata as Record<string, unknown>)
        : null
      return {
        id: r.id,
        stato: r.stato,
        created_at: r.created_at,
        giorni_in_stato: giorni,
        mittente: r.mittente,
        file_name: r.file_name,
        file_url: r.file_url,
        pending_kind: (meta?.pending_kind as string | null) ?? null,
      }
    })

    const statementsWithIssues: StatementIssue[] = (statementsWithIssuesRes.data ?? []).map((r) => ({
      id: r.id,
      fornitore_id: r.fornitore_id,
      file_url: r.file_url,
      missing_rows: r.missing_rows,
      created_at: r.created_at,
    }))

    const syncErrors: SyncError[] = (syncErrorsRes.data ?? []).map((r) => ({
      id: r.id,
      data: r.data,
      stato: r.stato,
      sede_id: r.sede_id,
      message: (r.message as string | null) ?? null,
    }))

    const totalBloccati = stuckDocuments.length
    const totalDaRevisionare = daRevisionare.length
    const totalStatementIssues = statementsWithIssues.length
    const totalErroriSincro = syncErrors.length
    const totaleReale = totale ?? 0
    const terminalStates = ['associato', 'scartato']
    const terminalCount = statoCounts
      .filter((s) => terminalStates.includes(s.stato))
      .reduce((sum, s) => sum + s.count, 0)
    const tasso = totaleReale > 0 ? Math.round((terminalCount / totaleReale) * 10000) / 100 : 0

    const result: AuditResult = {
      riepilogo: {
        totale: totaleReale,
        per_stato: statoCounts,
      },
      documenti_bloccati: stuckDocuments,
      documenti_da_revisionare: daRevisionare,
      statement_con_problemi: statementsWithIssues,
      errori_sincronizzazione_recenti: syncErrors,
      statistiche: {
        tasso_completamento: tasso,
        totale_bloccati: totalBloccati,
        totale_da_revisionare: totalDaRevisionare,
        totale_statement_issues: totalStatementIssues,
        totale_errori_sincro: totalErroriSincro,
      },
    }

    return NextResponse.json(result)
  } catch (err) {
    logger.error('Errore document-processing-audit', err)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
