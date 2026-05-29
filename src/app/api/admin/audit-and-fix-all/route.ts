import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import {
  auditAndFixDeterministic,
  auditAndFixWithAi,
  auditAndFixCompleto,
  auditAndFixFullRescan,
  auditAndCleanupMisclassified,
  auditAndCleanupOrphanConfermeOrdine,
  getAuditPendingCounts,
  type AuditBatchResult,
  type AuditPhase,
  type AuditPendingCounts,
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
    | 'completo'
    | 'with_ai'
    | 'full_rescan'
    | 'completo_tutti'
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
  /** Solo `full_rescan`: cursor estratti dopo fine coda documenti. */
  statement_after_id?: string | null
  /** Per cleanup_*: ritorna l'elenco senza modificare. Default false. */
  dry_run?: boolean
}

type ApiResponse =
  | (AuditBatchResult & { ok: true })
  | { ok: false; error: string }

type StatusResponse =
  | ({ ok: true } & AuditPendingCounts)
  | { ok: false; error: string }

async function resolveAuditAuth(req: NextRequest): Promise<
  | { ok: true; userId: string | null; scopedSedeId: string | null }
  | { ok: false; response: NextResponse<ApiResponse | StatusResponse> }
> {
  const cronSecret = process.env.CRON_SECRET?.trim()
  const authHeader = req.headers.get('authorization')?.trim() ?? ''
  const cronAuthorized = !!cronSecret && authHeader === `Bearer ${cronSecret}`

  if (cronAuthorized) {
    return { ok: true, userId: null, scopedSedeId: null }
  }

  const profile = await getProfile()
  if (!profile) {
    return { ok: false, response: jsonError('Non autenticato', 401) }
  }
  const role = String(profile.role ?? '').toLowerCase()
  if (role === 'operatore') {
    return { ok: false, response: jsonError('Operatore: non autorizzato', 403) }
  }
  if (!isMasterAdminRole(profile.role) && !isSedePrivilegedRole(profile.role)) {
    return { ok: false, response: jsonError('Solo amministratore o responsabile sede', 403) }
  }

  return {
    ok: true,
    userId: profile.id,
    scopedSedeId: isSedePrivilegedRole(profile.role)
      ? profile.sede_id?.trim() ?? null
      : null,
  }
}

function resolveSedeFilter(
  scopedSedeId: string | null,
  requestedSede: string,
): { sedeFilter: string | null; error?: NextResponse<ApiResponse | StatusResponse> } {
  const sedeFilter =
    scopedSedeId !== null ? scopedSedeId : requestedSede || null

  if (scopedSedeId !== null && requestedSede && requestedSede !== scopedSedeId) {
    return { sedeFilter, error: jsonError('Sede non consentita', 403) }
  }

  return { sedeFilter }
}

/**
 * GET `/api/admin/audit-and-fix-all?sede_id=…`
 *
 * Conteggi checkpoint per passata veloce, AI e «Completo + AI».
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await resolveAuditAuth(req)
    if (!auth.ok) return auth.response

    const requestedSede = req.nextUrl.searchParams.get('sede_id')?.trim() ?? ''
    const { sedeFilter, error } = resolveSedeFilter(auth.scopedSedeId, requestedSede)
    if (error) return error

    const service = createServiceClient()
    const counts = await getAuditPendingCounts(service, sedeFilter)

    return NextResponse.json<StatusResponse>({ ok: true, ...counts })
  } catch (e) {
    console.error('[audit-and-fix-all:status]', e)
    const msg = e instanceof Error ? e.message : 'Errore sconosciuto'
    return jsonError(msg, 500)
  }
}

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
 * - **completo** / **with_ai** — pass1 + pass2 per documento, poi checkpoint
 *   `metadata.audit_completo_at` (incrementale: solo documenti nuovi al richiamo).
 *
 * Auth:
 * - Se header `Authorization: Bearer <CRON_SECRET>` → autorizzato come admin (per CLI)
 * - Altrimenti richiede session admin / sede_privileged
 *
 * Va chiamato in loop dal client finché `has_more === false`.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await resolveAuditAuth(req)
    if (!auth.ok) return auth.response

    const { userId, scopedSedeId } = auth

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
    else if (rawPhase === 'completo' || rawPhase === 'with_ai') phase = 'completo'
    else if (rawPhase === 'full_rescan' || rawPhase === 'completo_tutti') phase = 'full_rescan'
    else if (rawPhase === 'cleanup' || rawPhase === 'cleanup_misclassified')
      phase = 'cleanup_misclassified'
    else if (rawPhase === 'cleanup_conferme_ordine' || rawPhase === 'cleanup_co')
      phase = 'cleanup_conferme_ordine'
    else phase = 'deterministic'

    const requestedSede =
      typeof body.sede_id === 'string' ? body.sede_id.trim() : ''

    const { sedeFilter, error: sedeError } = resolveSedeFilter(scopedSedeId, requestedSede)
    if (sedeError) return sedeError

    const batchSize =
      typeof body.batch_size === 'number' && Number.isFinite(body.batch_size)
        ? Math.max(1, Math.floor(body.batch_size))
        : undefined

    const force = body.force === true
    const afterId =
      typeof body.after_id === 'string' && body.after_id.trim()
        ? body.after_id.trim()
        : null
    const statementAfterId =
      typeof body.statement_after_id === 'string' && body.statement_after_id.trim()
        ? body.statement_after_id.trim()
        : null

    // ── 3. Pre-check Gemini key per pass2 / completo ─────────────────────────
    if (
      (phase === 'ai' || phase === 'completo' || phase === 'full_rescan') &&
      !process.env.GEMINI_API_KEY?.trim()
    ) {
      return jsonError(
        phase === 'completo' || phase === 'full_rescan'
          ? 'GEMINI_API_KEY non configurata: passata con AI non disponibile'
          : 'GEMINI_API_KEY non configurata: pass2 (AI) non disponibile',
        503,
      )
    }

    const service = createServiceClient()

    // ── 4. Esegui passata richiesta ──────────────────────────────────────────
    let result: AuditBatchResult
    if (phase === 'full_rescan') {
      result = await auditAndFixFullRescan(service, {
        sedeId: sedeFilter,
        batchSize,
        afterId,
        statementAfterId,
      })
    } else if (phase === 'completo') {
      result = await auditAndFixCompleto(service, {
        sedeId: sedeFilter,
        batchSize,
        force,
        afterId,
      })
    } else if (phase === 'ai') {
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

function jsonError(
  message: string,
  status: number,
): NextResponse<ApiResponse | StatusResponse> {
  return NextResponse.json<ApiResponse>({ ok: false, error: message }, { status })
}
