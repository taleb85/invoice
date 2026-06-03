import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isSedePrivilegedRole } from '@/lib/roles'
import { analyzeAnomaliePerFornitore, autoRisolviPerFornitoreChunk } from '@/lib/statement-auto-resolve'
import { runEmailScanForFornitore } from '@/app/api/scan-emails/route'
import { findStatementRowByNumeroDoc } from '@/lib/fattura-duplicate-check'
import { runTripleCheck } from '@/lib/triple-check'

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
 * Esegue le 3 fasi della pipeline AI per un singolo fornitore.
 * Se `statement_id` è fornito, le fasi 1 e 3 sono scoped a quello statement:
 *   - Fase 1: analisi read-only delle anomalie (fornitore o statement singolo)
 *   - Fase 2: ricerca documenti nella casella email (solo se fattura_mancante > 0 e email presente)
 *   - Fase 3: associazione automatica scoped al solo statement (se fornito)
 *
 * Body: { sede_id: string; fornitore_id: string; statement_id?: string; fattura_mancante_count?: number; has_email?: boolean }
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
    statement_id?: string
    /** Quando il client fornisce già i conteggi da checkResults, evitiamo una query ridondante */
    fattura_mancante_count?: number
    has_email?: boolean
    /**
     * Quando true, salta la fase 2 (scan IMAP) — il client l'ha già eseguita in
     * modalità streaming via `/api/scan-emails`, mostrando i log live all'utente.
     * Senza questo flag, la pipeline farebbe DUE scan IMAP (uno streaming dal client,
     * uno silenzioso dal server): lento e costoso.
     */
    skip_email_scan?: boolean
  }
  const { sede_id, fornitore_id, statement_id, fattura_mancante_count, has_email, skip_email_scan } = body
  if (!sede_id) return NextResponse.json({ error: 'sede_id obbligatorio' }, { status: 400 })
  if (!fornitore_id) return NextResponse.json({ error: 'fornitore_id obbligatorio' }, { status: 400 })

  const supabase = createServiceClient()

  // ── Fase 1: Analisi ──────────────────────────────────────────────────────
  // Se il client ha già i conteggi (da checkResults), evitiamo la query globale.
  let analisi: PipelinePerFornitoreResult['analisi']
  if (fattura_mancante_count !== undefined) {
    analisi = {
      fatturaMancante: fattura_mancante_count,
      bolleMancanti: 0,
      erroreImporto: 0,
      rekkiDiscordanza: 0,
      total: fattura_mancante_count,
      hasEmail: has_email ?? false,
    }
  } else {
    const analisiData = await analyzeAnomaliePerFornitore(supabase, sede_id, 0, 1, fornitore_id)
    const row = analisiData.results[0]
    analisi = {
      fatturaMancante: row?.fatturaMancante ?? 0,
      bolleMancanti: row?.bolleMancanti ?? 0,
      erroreImporto: row?.erroreImporto ?? 0,
      rekkiDiscordanza: row?.rekkiDiscordanza ?? 0,
      total: row?.total ?? 0,
      hasEmail: row?.hasEmail ?? false,
    }
  }

  // ── Fase 2: Ricerca email ────────────────────────────────────────────────
  // Se il client ha già eseguito lo scan in streaming, saltiamo: la fase 2
  // viene marcata come "skipped" (ricerca=null lasciato com'era).
  let ricerca: PipelinePerFornitoreResult['ricerca'] = null
  if (!skip_email_scan && analisi.fatturaMancante > 0 && analisi.hasEmail) {
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
  let assoc: PipelinePerFornitoreResult['assoc']
  let remainingAnomalies: number

  if (statement_id) {
    // Scoped a un singolo statement: triple-check + update rows
    const { data: stmtRow } = await supabase
      .from('statements')
      .select('id, fornitore_id, sede_id')
      .eq('id', statement_id)
      .single()

    if (!stmtRow) {
      assoc = { resolved: 0, remaining: 0, fastFixed: 0 }
      remainingAnomalies = analisi.total
    } else {
      // Run triple-check for this statement only
      const { data: rows } = await supabase
        .from('statement_rows')
        .select('id, numero_doc, importo, data_doc, check_status')
        .eq('statement_id', statement_id)

      const lines = (rows ?? []).map((r) => ({
        numero: r.numero_doc ?? '',
        importo: r.importo ?? 0,
        data: r.data_doc ?? null,
      }))

      const { results: checkRes } = await runTripleCheck(
        supabase,
        lines,
        stmtRow.sede_id,
        stmtRow.fornitore_id,
      )

      let remaining = 0
      for (const r of checkRes) {
        const dbRow = findStatementRowByNumeroDoc(rows ?? [], r.numero)
        if (!dbRow) continue

        const bolle_json =
          r.bolle.length > 0
            ? r.bolle.map((b) => ({
                id: b.id,
                numero_bolla: b.numero_bolla,
                importo: b.importo,
                data: b.data,
              }))
            : null

        await supabase.from('statement_rows').update({
          check_status: r.status,
          fattura_id: r.fattura?.id ?? null,
          bolle_json,
          delta_importo: r.deltaImporto ?? null,
        }).eq('id', dbRow.id)

        if (r.status !== 'ok') remaining++
      }

      const prevAnomale = (rows ?? []).filter(
        (r) => r.check_status !== 'ok' && r.check_status !== null,
      ).length
      remainingAnomalies = remaining

      // Update statement counters
      await supabase.from('statements').update({
        total_rows: checkRes.length,
        missing_rows: remaining,
      }).eq('id', statement_id)

      assoc = { resolved: Math.max(0, prevAnomale - remaining), remaining, fastFixed: 0 }
    }
  } else {
    // Fornitore-wide: usa il chunk generico
    const assocData = await autoRisolviPerFornitoreChunk(supabase, sede_id, 0, 9999, fornitore_id)
    const assocRow = assocData.results.find((r) => r.fornitoreId === fornitore_id)
    assoc = {
      resolved: assocRow?.righeOk ?? 0,
      remaining: assocRow?.righeAnomale ?? 0,
      fastFixed: assocData.fastFixed ?? 0,
    }
    remainingAnomalies = assocData.remainingAnomalies ?? analisi.total
  }

  const result: PipelinePerFornitoreResult = {
    fornitoreId: fornitore_id,
    fornitoreNome: null,
    analisi,
    ricerca,
    assoc,
    remainingAnomalies,
  }

  return NextResponse.json(result)
}
