import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isSedePrivilegedRole } from '@/lib/roles'
import {
  getFornitoriConFattureMancanti,
  autoRisolviStatementRows,
  countAnomalousStatementRows,
  type FornitoreConFattureMancanti,
} from '@/lib/statement-auto-resolve'
import { runEmailScanForFornitore } from '@/app/api/scan-emails/route'

/**
 * POST /api/centro-controllo/ai-cerca-fatture-mancanti
 *
 * Scansione AI per anomalie: per ogni fornitore con righe `fattura_mancante` nella sede
 * lancia una scansione IMAP mirata, poi riesegue il triple-check.
 *
 * Risposta chunked: la lista viene processata `chunk_size` fornitori per volta.
 * Il client chiama in loop finché `done === true`.
 *
 * Body: { sede_id: string; offset?: number; chunk_size?: number }
 * Risposta: { done: boolean; offset: number; total: number; results: ChunkResult[]; summary?: FinalSummary }
 */

type ChunkResult = {
  fornitoreId: string
  fornitoreNome: string | null
  fattureMancanti: number
  ricevuti: number
  bozzeCreate: number
  attachmentsProcessed: number
  ok: boolean
  error?: string
}

type FinalSummary = {
  initialAnomalies: number
  remainingAnomalies: number
  resolved: number
  fornitoriFailed: string[]
}

export async function POST(req: NextRequest) {
  const auth = await getRequestAuth()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile()
  if (!profile || !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    sede_id?: string
    offset?: number
    chunk_size?: number
  }

  const { sede_id, offset = 0, chunk_size = 3 } = body

  if (!sede_id) {
    return NextResponse.json({ error: 'sede_id obbligatorio' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Load full list of fornitori with fattura_mancante anomalies
  const allFornitori: FornitoreConFattureMancanti[] = await getFornitoriConFattureMancanti(supabase, sede_id)
  // Only include fornitori that actually have anomalies (count > 0 already guaranteed by the function)
  const total = allFornitori.length

  if (total === 0) {
    return NextResponse.json({
      done: true,
      offset: 0,
      total: 0,
      results: [],
      summary: {
        initialAnomalies: 0,
        remainingAnomalies: 0,
        resolved: 0,
        fornitoriFailed: [],
      },
    })
  }

  const chunk = allFornitori.slice(offset, offset + chunk_size)
  const isLastChunk = offset + chunk_size >= total

  const results: ChunkResult[] = []
  const fornitoriFailed: string[] = []

  for (const f of chunk) {
    // Calculate lookback in days from today to minData + 30-day buffer
    let lookbackDays = 400
    if (f.minData) {
      const minDateMs = new Date(f.minData).getTime()
      const daysSince = Math.ceil((Date.now() - minDateMs) / 86_400_000) + 30
      lookbackDays = Math.min(Math.max(daysSince, 60), 730)
    }

    const scanResult = await runEmailScanForFornitore({
      fornitoreId: f.fornitoreId,
      filterSedeId: sede_id,
      lookbackDaysOverride: lookbackDays,
    })

    results.push({
      fornitoreId: f.fornitoreId,
      fornitoreNome: f.fornitoreNome,
      fattureMancanti: f.count,
      ricevuti: scanResult.ricevuti,
      bozzeCreate: scanResult.bozzeCreate,
      attachmentsProcessed: scanResult.attachmentsProcessed,
      ok: scanResult.ok,
      error: scanResult.error,
    })

    if (!scanResult.ok) {
      fornitoriFailed.push(f.fornitoreNome ?? f.fornitoreId)
    }
  }

  if (isLastChunk) {
    // After last chunk: re-run auto-resolve (triple-check) to close newly imported invoices
    const initialAnomalies = await countAnomalousStatementRows(supabase, sede_id)
    await autoRisolviStatementRows(supabase, sede_id)
    const remainingAnomalies = await countAnomalousStatementRows(supabase, sede_id)

    return NextResponse.json({
      done: true,
      offset: offset + chunk.length,
      total,
      results,
      summary: {
        initialAnomalies,
        remainingAnomalies,
        resolved: Math.max(0, initialAnomalies - remainingAnomalies),
        fornitoriFailed,
      },
    })
  }

  return NextResponse.json({
    done: false,
    offset: offset + chunk.length,
    total,
    results,
  })
}
