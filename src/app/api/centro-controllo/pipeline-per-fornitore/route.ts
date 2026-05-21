import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isSedePrivilegedRole } from '@/lib/roles'
import { analyzeAnomaliePerFornitore } from '@/lib/statement-auto-resolve'
import { runEmailScanForFornitore } from '@/app/api/scan-emails/route'
import { autoRisolviPerFornitoreChunk } from '@/lib/statement-auto-resolve'

export type PipelinePerFornitoreResult = {
  fornitoreId: string
  fornitoreNome: string | null
  /** Fase 1 — Analisi */
  analisi: {
    fatturaMancante: number
    bolleMancanti: number
    erroreImporto: number
    rekkiDiscordanza: number
    total: number
    hasEmail: boolean
  }
  /** Fase 2 — Ricerca email (null se non eseguita) */
  ricerca: { imported: number; ok: boolean; error?: string } | null
  /** Fase 3 — Associazione */
  assoc: { resolved: number; remaining: number; fastFixed: number }
  /** Anomalie ancora aperte dopo la pipeline */
  remainingAnomalies: number
}

/**
 * POST /api/centro-controllo/pipeline-per-fornitore
 *
 * Esegue le 3 fasi della pipeline AI per un singolo fornitore:
 *   1. Analisi read-only delle anomalie
 *   2. Ricerca documenti nella casella email (solo se fattura_mancante > 0 e email presente)
 *   3. Associazione automatica (triple-check + chiusura righe risolvibili)
 *
 * Body: { sede_id: string; fornitore_id: string }
 */
export async function POST(req: NextRequest) {
  const auth = await getRequestAuth()
  if (!auth.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile()
  if (!profile || !isSedePrivilegedRole(profile.role)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as {
    sede_id?: string
    fornitore_id?: string
  }
  const { sede_id, fornitore_id } = body
  if (!sede_id) return NextResponse.json({ error: 'sede_id obbligatorio' }, { status: 400 })
  if (!fornitore_id) return NextResponse.json({ error: 'fornitore_id obbligatorio' }, { status: 400 })

  const supabase = createServiceClient()

  // ── Fase 1: Analisi ─────────────────────────────────────────────────────
  const analisiData = await analyzeAnomaliePerFornitore(supabase, sede_id, 0, 1, fornitore_id)
  const analisi = analisiData.results[0] ?? {
    fornitoreId: fornitore_id,
    fornitoreNome: null,
    fatturaMancante: 0,
    bolleMancanti: 0,
    erroreImporto: 0,
    rekkiDiscordanza: 0,
    pending: 0,
    total: 0,
    hasEmail: false,
  }

  // ── Fase 2: Ricerca email ────────────────────────────────────────────────
  let ricerca: PipelinePerFornitoreResult['ricerca'] = null
  if (analisi.fatturaMancante > 0 && analisi.hasEmail) {
    const emailResult = await runEmailScanForFornitore({
      fornitoreId: fornitore_id,
      filterSedeId: sede_id,
    })
    ricerca = {
      imported: emailResult.bozzeCreate,
      ok: emailResult.ok,
      error: emailResult.error,
    }
  }

  // ── Fase 3: Associazione ─────────────────────────────────────────────────
  // Run a single chunk that covers all statements for this supplier
  const assocData = await autoRisolviPerFornitoreChunk(supabase, sede_id, 0, 9999, fornitore_id)
  const assocRow = assocData.results.find((r) => r.fornitoreId === fornitore_id)

  const result: PipelinePerFornitoreResult = {
    fornitoreId: fornitore_id,
    fornitoreNome: analisi.fornitoreNome,
    analisi: {
      fatturaMancante: analisi.fatturaMancante,
      bolleMancanti: analisi.bolleMancanti,
      erroreImporto: analisi.erroreImporto,
      rekkiDiscordanza: analisi.rekkiDiscordanza,
      total: analisi.total,
      hasEmail: analisi.hasEmail,
    },
    ricerca,
    assoc: {
      resolved: assocRow?.righeOk ?? 0,
      remaining: assocRow?.righeAnomale ?? 0,
      fastFixed: assocData.fastFixed ?? 0,
    },
    remainingAnomalies: assocData.remainingAnomalies ?? analisi.total,
  }

  return NextResponse.json(result)
}
