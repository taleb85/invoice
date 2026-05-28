import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import {
  auditAndFixDeterministic,
  auditAndFixWithAi,
  auditAndCleanupMisclassified,
  auditAndCleanupOrphanConfermeOrdine,
  type AuditBatchResult,
  type AuditPhase,
} from '@/lib/audit-and-fix-all'
import { logActivity, ACTIVITY_ACTIONS } from '@/lib/activity-logger'

export const dynamic = 'force-dynamic'
/** Pass 2 (AI) può richiedere fino a 60s su batch di 5 documenti. Cleanup è veloce.
 *  Cleanup esteso ora supporta auto-promote/demote tra bolle e fatture e una
 *  passata aggiuntiva `cleanup_conferme_ordine` per voci orfane in conferme_ordine.
 *  Voting weighted con tie-aware pulisce solo casi con margine sufficiente. */
export const maxDuration = 300

type Body = {
  /**
   * - `deterministic` / `pass1` — pass1 veloce, gratis
   * - `ai` / `pass2` — pass2 Gemini Vision
   * - `cleanup_misclassified` / `cleanup` — pulizia bolle/fatture orfane,
   *   con auto-promote/demote tra bolle e fatture quando pending_kind è incoerente
   * - `cleanup_conferme_ordine` — pulizia voci in `conferme_ordine` il cui
   *   documento sorgente non è più classificato come ordine
   * Default: `deterministic`.
   */
  phase?:
    | 'deterministic'
    | 'ai'
    | 'pass1'
    | 'pass2'
    | 'cleanup_misclassified'
    | 'cleanup'
    | 'cleanup_conferme_ordine'
  /** Limita a una sede specifica. Master admin può lasciare null. */
  sede_id?: string | null
  /** Numero documenti per chiamata. Default: 50 (pass1) / 5 (pass2) / 25 (cleanup). */
  batch_size?: number
  /** Riprocessa anche documenti già marcati `audit_passN_at`. Default false. */
  force?: boolean
  /** Cursor paginazione: processa solo documenti con `id` maggiore (loop client). */
  after_id?: string | null
  /** Per cleanup_*: ritorna l'elenco senza modificare. Default false. */
  dry_run?: boolean
}

type ApiResponse =
  | (AuditBatchResult & { ok: true })
  | { ok: false; error: string }

/**
 * POST `/api/admin/audit-and-fix-all`
 *
 * Comando unico per ricontrollare la categorizzazione (fornitore + tipologia)
 * di TUTTI i documenti senza intervento manuale.
 *
 * Due modalità (eseguire prima `pass1`, poi `pass2`):
 *
 * - **pass1** (default, deterministico, gratis)
 *   Rilegge i metadata OCR già presenti, ricalcola fornitore + data + tipo con
 *   `runQualityChain` (2/3 segnali) e propaga le correzioni a `fatture`/`bolle`.
 *   Veloce, batch di 50, idempotente. Marca `metadata.audit_pass1_at`.
 *
 * - **pass2** (AI, costoso — chiama Gemini Vision)
 *   Per i documenti con file e mai auditati dall'AI moderna: scarica, classifica
 *   con Gemini, prova match fornitore per nome. Applica solo se confidenza ≥ 0.85.
 *   Batch di 5, marca `metadata.audit_pass2_at`.
 *
 * Auth:
 * - Se header `Authorization: Bearer <CRON_SECRET>` → autorizzato come admin (per CLI)
 * - Altrimenti richiede session admin / sede_privileged
 *
 * Va chiamato in loop dal client finché `has_more === false`.
 */
export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth: Bearer CRON_SECRET o sessione admin ──────────────────────────
    const cronSecret = process.env.CRON_SECRET?.trim()
    const authHeader = req.headers.get('authorization')?.trim() ?? ''
    const cronAuthorized = !!cronSecret && authHeader === `Bearer ${cronSecret}`

    let userId: string | null = null
    let scopedSedeId: string | null = null

    if (!cronAuthorized) {
      const profile = await getProfile()
      if (!profile) {
        return jsonError('Non autenticato', 401)
      }
      const role = String(profile.role ?? '').toLowerCase()
      if (role === 'operatore') {
        return jsonError('Operatore: non autorizzato', 403)
      }
      if (!isMasterAdminRole(profile.role) && !isSedePrivilegedRole(profile.role)) {
        return jsonError('Solo amministratore o responsabile sede', 403)
      }
      userId = profile.id
      // sede_privileged è limitato alla propria sede
      if (isSedePrivilegedRole(profile.role)) {
        scopedSedeId = profile.sede_id?.trim() ?? null
      }
    }

    // ── 2. Body & params ─────────────────────────────────────────────────────
    let body: Body = {}
    try {
      body = (await req.json()) as Body
    } catch {
      body = {}
    }

    const rawPhase = String(body.phase ?? 'deterministic').toLowerCase().trim()
    let phase: AuditPhase
    if (rawPhase === 'ai' || rawPhase === 'pass2') phase = 'ai'
    else if (rawPhase === 'cleanup' || rawPhase === 'cleanup_misclassified')
      phase = 'cleanup_misclassified'
    else if (rawPhase === 'cleanup_conferme_ordine' || rawPhase === 'cleanup_co')
      phase = 'cleanup_conferme_ordine'
    else phase = 'deterministic'

    const requestedSede =
      typeof body.sede_id === 'string' ? body.sede_id.trim() : ''

    // sede_privileged: forza la propria sede; admin/master/CRON: usa quella richiesta
    const sedeFilter =
      scopedSedeId !== null
        ? scopedSedeId
        : requestedSede || null

    if (scopedSedeId !== null && requestedSede && requestedSede !== scopedSedeId) {
      return jsonError('Sede non consentita', 403)
    }

    const batchSize =
      typeof body.batch_size === 'number' && Number.isFinite(body.batch_size)
        ? Math.max(1, Math.floor(body.batch_size))
        : undefined

    const force = body.force === true
    const afterId =
      typeof body.after_id === 'string' && body.after_id.trim()
        ? body.after_id.trim()
        : null

    // ── 3. Pre-check Gemini key per pass2 ────────────────────────────────────
    if (phase === 'ai' && !process.env.GEMINI_API_KEY?.trim()) {
      return jsonError('GEMINI_API_KEY non configurata: pass2 (AI) non disponibile', 503)
    }

    const service = createServiceClient()

    // ── 4. Esegui passata richiesta ──────────────────────────────────────────
    let result: AuditBatchResult
    if (phase === 'ai') {
      result = await auditAndFixWithAi(service, {
        sedeId: sedeFilter,
        batchSize,
        force,
        afterId,
      })
    } else if (phase === 'cleanup_misclassified') {
      result = await auditAndCleanupMisclassified(service, {
        sedeId: sedeFilter,
        batchSize,
        force,
        dryRun: body.dry_run === true,
      })
    } else if (phase === 'cleanup_conferme_ordine') {
      result = await auditAndCleanupOrphanConfermeOrdine(service, {
        sedeId: sedeFilter,
        batchSize,
        dryRun: body.dry_run === true,
      })
    } else {
      result = await auditAndFixDeterministic(service, {
        sedeId: sedeFilter,
        batchSize,
        force,
        afterId,
      })
    }

    // ── 5. Log attività (solo se cambiato qualcosa o sessione utente) ────────
    if (userId && (result.fornitore_fixed > 0 || result.tipo_fixed > 0)) {
      await logActivity(service, {
        userId,
        sedeId: sedeFilter,
        action: ACTIVITY_ACTIONS.DOCUMENTO_PROCESSED,
        entityType: 'documenti_da_processare',
        metadata: {
          audit_run: true,
          phase: result.phase,
          checked: result.checked,
          fornitore_fixed: result.fornitore_fixed,
          tipo_fixed: result.tipo_fixed,
          flagged_for_review: result.flagged_for_review,
          force,
        },
      })
    }

    return NextResponse.json<ApiResponse>({ ok: true, ...result })
  } catch (e) {
    console.error('[audit-and-fix-all]', e)
    const msg = e instanceof Error ? e.message : 'Errore sconosciuto'
    return jsonError(msg, 500)
  }
}

function jsonError(message: string, status: number): NextResponse<ApiResponse> {
  return NextResponse.json<ApiResponse>({ ok: false, error: message }, { status })
}
