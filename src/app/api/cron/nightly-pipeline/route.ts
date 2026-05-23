import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'
import { autoRisolviPerFornitoreChunk } from '@/lib/statement-auto-resolve'
import { logger } from '@/lib/logger'

export const maxDuration = 300

/**
 * CRON /api/cron/nightly-pipeline
 *
 * Runs at 04:00 every night (after sync-emails at 03:00).
 * For every active sede, iterates autoRisolviPerFornitoreChunk until done,
 * closing statement anomalies automatically without any human intervention.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET non configurato' }, { status: 500 })

  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const { data: sedi, error: sediErr } = await supabase
    .from('sedi')
    .select('id, nome')

  if (sediErr || !sedi || sedi.length === 0) {
    logger.info('[NIGHTLY-PIPELINE] Nessuna sede trovata')
    return NextResponse.json({ sediProcessate: 0, anomalieRisolte: 0, anomalieRimaste: 0 })
  }

  let totalRisolte = 0
  let totalRimaste = 0

  for (const sede of sedi) {
    try {
      let offset = 0
      const chunkSize = 6

      while (true) {
        const result = await autoRisolviPerFornitoreChunk(supabase, sede.id, offset, chunkSize)

        const risolte = (result.fastFixed ?? 0) + result.results.reduce((acc, r) => acc + r.righeOk, 0)
        totalRisolte += risolte

        if (result.done) {
          totalRimaste += result.remainingAnomalies ?? 0
          logger.info(`[NIGHTLY-PIPELINE] ${sede.nome}: done — rimaste ${result.remainingAnomalies} anomalie`)
          break
        }

        offset = result.offset + chunkSize
      }
    } catch (err) {
      logger.info(`[NIGHTLY-PIPELINE] Errore per sede ${sede.nome}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  logger.info(`[NIGHTLY-PIPELINE] Completato — ${sedi.length} sedi, ${totalRisolte} righe risolte, ${totalRimaste} anomalie rimaste`)

  return NextResponse.json({
    sediProcessate: sedi.length,
    anomalieRisolte: totalRisolte,
    anomalieRimaste: totalRimaste,
  })
}
