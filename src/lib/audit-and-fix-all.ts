import type { SupabaseClient } from '@supabase/supabase-js'
import { runQualityChain } from '@/lib/document-quality-chain'
import { classifyDocumentWithGemini } from '@/lib/gemini-inbox-classify'
import { resolveFornitoreByPartialNameEnhanced } from '@/lib/fornitore-infer-from-document'
import { normalizeTipoDocumento, type NormalizedTipoDocumento } from '@/lib/ocr-tipo-documento'
import {
  fixStatementFornitoreDriftBatch,
  propagateFornitoreFromPendingDoc,
  resolveFornitoreFromStatementSubject,
} from '@/lib/audit-statement-fornitore-fix'
import { extractStatementFromSupplierName } from '@/lib/statement-supplier-subject'
import { logger } from '@/lib/logger'

/**
 * Audit & fix unico: in una sola passata controlla TUTTI i documenti
 * (qualunque stato) e prova a correggere automaticamente fornitore + tipologia
 * usando solo i segnali già acquisiti, e — se richiesto — Gemini Vision.
 *
 * Chiamato in loop dall'endpoint `/api/admin/audit-and-fix-all`. Ogni invocazione
 * processa un piccolo batch e ritorna `has_more` finché restano documenti idonei.
 *
 * Idempotente: marca `metadata.audit_pass1_at` (passata deterministica),
 * `metadata.audit_pass2_at` (passata AI) e `metadata.audit_completo_at`
 * (passata «Completo + AI») sui documenti già revisionati così non vengono
 * ritoccati ai cicli successivi.
 */

// ── Soglie ────────────────────────────────────────────────────────────────────

/** Confidenza minima della passata AI per applicare automaticamente un nuovo tipo. */
export const AUDIT_AI_AUTO_APPLY_MIN_CONFIDENCE = 0.85

/** Pattern testuali (subject/filename) che identificano una conferma d'ordine. */
const ORDER_CONFIRMATION_PATTERN =
  /\border\s+confirmation\b|\border\s+acknowledg|\border\s+confirmed\b|\bsales\s+order\s+confirm|\bpurchase\s+order\b.{0,40}\bconfirm|conferma\s+(d['’])?ordine|ordine\s+confermato/i

// ── Tipi ──────────────────────────────────────────────────────────────────────

export type AuditPhase =
  | 'deterministic'
  | 'ai'
  | 'completo'
  | 'cleanup_misclassified'
  | 'cleanup_conferme_ordine'

export type AuditPendingCounts = {
  total: number
  pass1_remaining: number
  pass2_remaining: number
  /** Documenti in coda non ancora completati con «Completo + AI». */
  completo_remaining: number
  /** Documenti con checkpoint `audit_completo_at` (incrementale). */
  completo_done: number
}

export type AuditDocChange = {
  doc_id: string
  fornitore_id_before: string | null
  fornitore_id_after: string | null
  tipo_before: string | null
  tipo_after: string | null
  fattura_id: string | null
  bolla_id: string | null
  /** Etichetta diagnostica della modifica per il report. */
  reason: string
}

export type AuditCleanupAction = {
  doc_id: string
  fornitore_nome: string | null
  oggetto_mail: string | null
  file_name: string | null
  pending_kind: string | null
  /** Etichetta sintetica del tipo di azione fatta. */
  action_kind:
    | 'delete_orphan_bolla'
    | 'delete_orphan_fattura'
    | 'delete_orphan_conferma_ordine'
    | 'promote_bolla_to_fattura'
    | 'demote_fattura_to_bolla'
  /** Cosa stava per essere cancellato: bolla_id, fattura_id, conferma_ordine_id. */
  deleted_bolla_id: string | null
  deleted_fattura_id: string | null
  deleted_conferma_ordine_id: string | null
  /** Fatture orfane che puntavano alla bolla cancellata. */
  deleted_orphan_fattura_ids: string[]
  /** ID della riga creata in caso di promote/demote. */
  created_fattura_id: string | null
  created_bolla_id: string | null
  /** True solo se è stato applicato (non dry-run). */
  applied: boolean
}

export type AuditBatchResult = {
  phase: AuditPhase
  checked: number
  fornitore_fixed: number
  tipo_fixed: number
  flagged_for_review: number
  unchanged: number
  errors: number
  has_more: boolean
  changes: AuditDocChange[]
  /** Conteggio totale candidati ancora idonei alla fase corrente (al momento della query). */
  remaining_estimate: number
  /** Ultimo `id` processato nel batch — passarlo come `after_id` alla chiamata successiva. */
  next_after_id?: string | null
  /** Solo per phase='cleanup_misclassified'. */
  cleanup_actions?: AuditCleanupAction[]
  /** True quando in modalità dry-run (cleanup non applicato). */
  dry_run?: boolean
}

type DocRow = {
  id: string
  fornitore_id: string | null
  sede_id: string | null
  mittente: string | null
  oggetto_mail: string | null
  file_name: string | null
  file_url: string | null
  content_type: string | null
  note: string | null
  data_documento: string | null
  created_at: string | null
  metadata: Record<string, unknown> | null
  stato: string | null
  fattura_id: string | null
  bolla_id: string | null
  is_statement: boolean | null
}

const DOC_SELECT =
  'id, fornitore_id, sede_id, mittente, oggetto_mail, file_name, file_url, content_type, note, data_documento, created_at, metadata, stato, fattura_id, bolla_id, is_statement'

// ── Pass 1: deterministico (no Gemini) ────────────────────────────────────────

type Pass1Opts = {
  sedeId?: string | null
  /** Quanti documenti processare per ciclo (default 50). */
  batchSize?: number
  /** Se true: tocca anche le righe già marcate `audit_pass1_at` (per re-run). */
  force?: boolean
  /** Paginazione stabile (obbligatoria in `force`): processa solo righe con `id` maggiore. */
  afterId?: string | null
}

function applyDocBatchCursor<T extends { gt: (col: string, val: string) => T }>(
  q: T,
  afterId?: string | null,
): T {
  if (afterId) return q.gt('id', afterId) as T
  return q
}

/**
 * Rilegge i metadata OCR già presenti, ricalcola fornitore/data/tipo con la
 * catena di fiducia (2/3 segnali) e propaga le correzioni a `fatture`/`bolle`.
 */
export async function auditAndFixDeterministic(
  service: SupabaseClient,
  opts: Pass1Opts = {},
): Promise<AuditBatchResult> {
  const batchSize = Math.min(Math.max(opts.batchSize ?? 50, 1), 200)
  const result: AuditBatchResult = {
    phase: 'deterministic',
    checked: 0,
    fornitore_fixed: 0,
    tipo_fixed: 0,
    flagged_for_review: 0,
    unchanged: 0,
    errors: 0,
    has_more: false,
    changes: [],
    remaining_estimate: 0,
  }

  let q = service
    .from('documenti_da_processare')
    .select(DOC_SELECT)
    .order('id', { ascending: true })

  if (!opts.force) {
    q = q.is('metadata->>audit_pass1_at', null) as typeof q
  }
  if (opts.sedeId) {
    q = q.eq('sede_id', opts.sedeId) as typeof q
  }
  q = applyDocBatchCursor(q, opts.afterId)

  const { data, error } = await q
    .limit(batchSize)
    .returns<DocRow[]>()

  if (error) {
    logger.error('[audit-and-fix:pass1] fetch error:', error.message)
    result.errors = 1
    return result
  }

  const remaining = await countRemaining(service, opts.sedeId ?? null, 'pass1', !!opts.force)
  result.remaining_estimate = remaining

  const docs = data ?? []

  for (const doc of docs) {
    result.checked++
    try {
      const change = await applyDeterministicFix(service, doc)
      if (change) {
        result.changes.push(change)
        if (change.fornitore_id_before !== change.fornitore_id_after) result.fornitore_fixed++
        if (change.tipo_before !== change.tipo_after) result.tipo_fixed++
      } else {
        result.unchanged++
      }
    } catch (e) {
      result.errors++
      logger.error('[audit-and-fix:pass1] doc', doc.id, e)
    }
  }

  let driftHasMore = false
  try {
    const drift = await fixStatementFornitoreDriftBatch(service, {
      sedeId: opts.sedeId ?? null,
      batchSize: 15,
      afterId: opts.afterId,
    })
    driftHasMore = drift.has_more
    for (const fix of drift.fixes) {
      result.fornitore_fixed++
      result.changes.push({
        doc_id: fix.statement_id,
        fornitore_id_before: fix.fornitore_id_before,
        fornitore_id_after: fix.fornitore_id_after,
        tipo_before: null,
        tipo_after: null,
        fattura_id: null,
        bolla_id: null,
        reason: 'statement_subject_drift',
      })
    }
    if (drift.fixes.length && drift.next_after_id) {
      result.next_after_id = drift.next_after_id
    }
  } catch (e) {
    result.errors++
    logger.error('[audit-and-fix:pass1] statement drift', e)
  }

  if (!result.next_after_id) {
    result.next_after_id = docs[docs.length - 1]?.id ?? null
  }
  result.has_more = docs.length === batchSize || driftHasMore
  return result
}

type PassCompletoOpts = {
  sedeId?: string | null
  /** Default 5 (include Gemini Vision per ogni file). */
  batchSize?: number
  force?: boolean
  afterId?: string | null
}

/**
 * Passata «Completo + AI»: per ogni documento in coda (qualsiasi tipo) esegue
 * pass1 deterministica + pass2 Gemini (se c'è un file), poi marca
 * `metadata.audit_completo_at` come checkpoint. Ai richiami successivi vengono
 * processati solo i documenti nuovi o mai completati.
 */
export async function auditAndFixCompleto(
  service: SupabaseClient,
  opts: PassCompletoOpts = {},
): Promise<AuditBatchResult> {
  const batchSize = Math.min(Math.max(opts.batchSize ?? 5, 1), 10)
  const result: AuditBatchResult = {
    phase: 'completo',
    checked: 0,
    fornitore_fixed: 0,
    tipo_fixed: 0,
    flagged_for_review: 0,
    unchanged: 0,
    errors: 0,
    has_more: false,
    changes: [],
    remaining_estimate: 0,
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error('GEMINI_API_KEY non configurata')
  }

  let q = service
    .from('documenti_da_processare')
    .select(DOC_SELECT)
    .order('id', { ascending: true })

  if (!opts.force) {
    q = q.is('metadata->>audit_completo_at', null) as typeof q
  }
  if (opts.sedeId) {
    q = q.eq('sede_id', opts.sedeId) as typeof q
  }
  q = applyDocBatchCursor(q, opts.afterId)

  const { data, error } = await q.limit(batchSize).returns<DocRow[]>()

  if (error) {
    logger.error('[audit-and-fix:completo] fetch error:', error.message)
    result.errors = 1
    return result
  }

  const remaining = await countRemaining(service, opts.sedeId ?? null, 'completo', !!opts.force)
  result.remaining_estimate = remaining

  const docs = data ?? []

  for (const doc of docs) {
    result.checked++
    try {
      const change1 = await applyDeterministicFix(service, doc)
      if (change1) {
        result.changes.push(change1)
        if (change1.fornitore_id_before !== change1.fornitore_id_after) result.fornitore_fixed++
        if (change1.tipo_before !== change1.tipo_after) result.tipo_fixed++
      }

      const { data: refreshed, error: refErr } = await service
        .from('documenti_da_processare')
        .select(DOC_SELECT)
        .eq('id', doc.id)
        .maybeSingle()

      if (refErr) {
        logger.error('[audit-and-fix:completo] refresh err', doc.id, refErr.message)
      }

      const current = (refreshed ?? doc) as DocRow

      if (current.file_url?.trim()) {
        const change2 = await applyAiFix(service, current)
        if (change2 === 'flagged') {
          result.flagged_for_review++
        } else if (change2) {
          result.changes.push(change2)
          if (change2.fornitore_id_before !== change2.fornitore_id_after) result.fornitore_fixed++
          if (change2.tipo_before !== change2.tipo_after) result.tipo_fixed++
        } else if (!change1) {
          result.unchanged++
        }
      } else if (!change1) {
        result.unchanged++
      }

      await stampCompletoCheckpoint(service, doc.id)
    } catch (e) {
      result.errors++
      logger.error('[audit-and-fix:completo] doc', doc.id, e)
      try {
        await stampCompletoCheckpoint(service, doc.id)
      } catch (stampErr) {
        logger.error('[audit-and-fix:completo] checkpoint err', doc.id, stampErr)
      }
    }
  }

  let driftHasMore = false
  try {
    const drift = await fixStatementFornitoreDriftBatch(service, {
      sedeId: opts.sedeId ?? null,
      batchSize: 15,
      afterId: opts.afterId,
    })
    driftHasMore = drift.has_more
    for (const fix of drift.fixes) {
      result.fornitore_fixed++
      result.changes.push({
        doc_id: fix.statement_id,
        fornitore_id_before: fix.fornitore_id_before,
        fornitore_id_after: fix.fornitore_id_after,
        tipo_before: null,
        tipo_after: null,
        fattura_id: null,
        bolla_id: null,
        reason: 'statement_subject_drift',
      })
    }
    if (drift.fixes.length && drift.next_after_id) {
      result.next_after_id = drift.next_after_id
    }
  } catch (e) {
    result.errors++
    logger.error('[audit-and-fix:completo] statement drift', e)
  }

  if (!result.next_after_id) {
    result.next_after_id = docs[docs.length - 1]?.id ?? null
  }
  result.has_more = docs.length === batchSize || driftHasMore
  return result
}

async function applyDeterministicFix(
  service: SupabaseClient,
  doc: DocRow,
): Promise<AuditDocChange | null> {
  const meta = sanitizeMetadata(doc.metadata)

  const ragioneSociale = stringOrNull(meta.ragione_sociale)
  const pIva = stringOrNull(meta.p_iva)
  const ocrTipo = stringOrNull(meta.tipo_documento)
  const ocrDate = stringOrNull(meta.data_fattura)

  const hasOcr = !!(ragioneSociale || pIva || ocrTipo || ocrDate)
  const hasStatementSubject = !!extractStatementFromSupplierName(doc.oggetto_mail)

  const subjectFornitore = await resolveFornitoreFromStatementSubject(service, {
    sedeId: doc.sede_id,
    oggetto_mail: doc.oggetto_mail,
    metadata: meta,
    mittente: doc.mittente,
  })

  if (!hasOcr && !hasStatementSubject) {
    await stampPass1(service, doc.id, meta, { skipped_reason: 'no_ocr_metadata' })
    return null
  }

  // Ricalcolo: se il fornitore è già "agganciato" tramite email/piva (segnale forte),
  // lo passiamo alla quality chain così `qualityDocumentType` può attivare il segnale
  // di apprendimento (`lookupLearnedType`) — cruciale per casi tipo Donovan dove
  // OCR è l'unico altro segnale ma c'è uno storico imparato pulito di pending_kind.
  // In ogni caso, la quality chain rivaluta il fornitore se il segnale chain è più forte.
  const matchedBy = stringOrNull(meta.matched_by)
  const fornitoreLocked =
    !!doc.fornitore_id && (matchedBy === 'email' || matchedBy === 'piva')
  const quality = await runQualityChain(service, {
    mittente: doc.mittente,
    sedeId: doc.sede_id,
    ocrRagioneSociale: ragioneSociale,
    ocrPiva: pIva,
    ocrDate,
    ocrTipo,
    receivedAt: doc.created_at,
    fileName: doc.file_name,
    emailSubject: doc.oggetto_mail,
    fornitoreId: fornitoreLocked ? doc.fornitore_id : null,
  })

  const updates: Record<string, unknown> = {}
  const updatedMeta: Record<string, unknown> = { ...meta }

  let fornitoreChanged = false
  let tipoChanged = false
  let fornitoreReason = ''

  // Inoltro estratto: «Statement from …» batte email mittente (matched_by email sul cliente).
  if (
    subjectFornitore?.id &&
    subjectFornitore.id !== doc.fornitore_id
  ) {
    updates.fornitore_id = subjectFornitore.id
    updatedMeta.matched_by = 'statement_subject'
    fornitoreChanged = true
    fornitoreReason = 'statement_subject'
  } else if (
    !fornitoreLocked &&
    quality.fornitoreConfidence >= 2 &&
    quality.fornitoreId &&
    quality.fornitoreId !== doc.fornitore_id
  ) {
    updates.fornitore_id = quality.fornitoreId
    updatedMeta.matched_by = quality.fornitoreSource
    fornitoreChanged = true
    fornitoreReason = quality.fornitoreSource ?? 'quality_chain'
  }

  if (
    quality.documentDate &&
    quality.documentDate !== (doc.data_documento?.trim() || null)
  ) {
    updates.data_documento = quality.documentDate
  }

  // Tipi pending_kind in cui l'OCR è "trusted" anche con typeConfidence=1.
  // Questi tipi non sono mai fallback OCR: se l'OCR li scrive, ha letto qualcosa
  // di esplicito nel documento. Mappiamo NormalizedTipoDocumento → pending_kind.
  // Caso reale: documento OCR=ordine ma subject/filename neutrali → typeConfidence=1
  // → fix non scattava. Risultato: 50+ ordini Donovan classificati come fattura.
  const ocrTipoNorm = normalizeTipoDocumento(ocrTipo)
  const ocrPendingKind: string | null = (() => {
    switch (ocrTipoNorm) {
      case 'ordine':
        return 'ordine'
      case 'estratto_conto':
        return 'statement'
      case 'nota_credito':
        return 'nota_credito'
      case 'fattura':
        return 'fattura'
      case 'bolla_ddt':
        return 'bolla'
      case 'comunicazione':
        return 'comunicazione'
      default:
        return null
    }
  })()
  const TRUSTED_OCR_PENDING_KINDS = new Set(['ordine', 'statement', 'nota_credito'])

  // Veto trust-OCR: se subject/filename ha un pattern testuale forte concorrente,
  // non sovrascrivere il pending_kind. Esempio: subject "Delivery Note" + OCR=ordine
  // (PDF probabilmente è una bolla, OCR ha sbagliato).
  const blobLower = `${doc.oggetto_mail ?? ''}\n${doc.file_name ?? ''}`.toLowerCase()
  const subjectIsBolla = /\b(delivery\s+note|ddt|bolla|sales\s+delivery)\b/.test(blobLower)
  const subjectIsFattura =
    /\b(invoice|fattura|tax\s+invoice|sales\s+invoice|a\/r\s+invoice)\b/.test(blobLower) &&
    !/sales\s+delivery/.test(blobLower)
  const subjectIsStatement = /\b(statement|estratto\s+conto)\b/.test(blobLower)
  let trustOcrVeto = false
  if (ocrPendingKind === 'ordine' && (subjectIsBolla || subjectIsFattura || subjectIsStatement))
    trustOcrVeto = true
  if (ocrPendingKind === 'statement' && (subjectIsBolla || subjectIsFattura)) trustOcrVeto = true
  if (ocrPendingKind === 'nota_credito' && (subjectIsFattura || subjectIsBolla)) trustOcrVeto = true

  const ocrIsTrusted =
    !trustOcrVeto && !!ocrPendingKind && TRUSTED_OCR_PENDING_KINDS.has(ocrPendingKind)

  const currentKind = stringOrNull(meta.pending_kind)
  if (
    quality.typeConfidence >= 2 &&
    quality.documentType &&
    quality.documentType !== currentKind
  ) {
    updatedMeta.pending_kind = quality.documentType
    if (quality.documentType === 'statement') updates.is_statement = true
    tipoChanged = true
  } else if (
    !tipoChanged &&
    ocrIsTrusted &&
    ocrPendingKind &&
    ocrPendingKind !== currentKind
  ) {
    // Trust-OCR fallback per tipi ad alta affidabilità OCR-only.
    // Questo è il caso del Sales Order Confirmation di Donovan: subject/filename
    // non hanno pattern, ma OCR ha letto "Sales Order Confirmation" nel documento.
    updatedMeta.pending_kind = ocrPendingKind
    if (ocrPendingKind === 'statement') updates.is_statement = true
    tipoChanged = true
  }

  if (!fornitoreChanged && !tipoChanged && !('data_documento' in updates)) {
    await stampPass1(service, doc.id, updatedMeta, null)
    return null
  }

  updatedMeta.audit_pass1_at = new Date().toISOString()
  updatedMeta.audit_pass1_changed = {
    fornitore: fornitoreChanged,
    tipo: tipoChanged,
    date: 'data_documento' in updates,
  }
  updates.metadata = updatedMeta

  const { error: updErr } = await service
    .from('documenti_da_processare')
    .update(updates)
    .eq('id', doc.id)

  if (updErr) throw new Error(updErr.message)

  const newFornitoreId = fornitoreChanged
    ? (updates.fornitore_id as string)
    : doc.fornitore_id

  if (fornitoreChanged && newFornitoreId) {
    await propagateFornitoreFromPendingDoc(service, {
      fornitoreId: newFornitoreId,
      fattura_id: doc.fattura_id,
      bolla_id: doc.bolla_id,
      file_url: doc.file_url,
    })
  }

  return {
    doc_id: doc.id,
    fornitore_id_before: doc.fornitore_id,
    fornitore_id_after: fornitoreChanged ? newFornitoreId : doc.fornitore_id,
    tipo_before: currentKind,
    tipo_after: tipoChanged ? quality.documentType : currentKind,
    fattura_id: doc.fattura_id,
    bolla_id: doc.bolla_id,
    reason: fornitoreReason
      ? `${fornitoreReason}+${buildReason(false, tipoChanged, 'data_documento' in updates)}`.replace(/\+no-change$/, '')
      : buildReason(fornitoreChanged, tipoChanged, 'data_documento' in updates),
  }
}

async function stampPass1(
  service: SupabaseClient,
  docId: string,
  baseMeta: Record<string, unknown>,
  extra: Record<string, unknown> | null,
): Promise<void> {
  const meta = {
    ...baseMeta,
    audit_pass1_at: new Date().toISOString(),
    ...(extra ?? {}),
  }
  const { error } = await service
    .from('documenti_da_processare')
    .update({ metadata: meta })
    .eq('id', docId)
  if (error) logger.error('[audit-and-fix:pass1] stamp err', docId, error.message)
}

// ── Pass 2: AI Gemini ─────────────────────────────────────────────────────────

type Pass2Opts = {
  sedeId?: string | null
  batchSize?: number
  force?: boolean
  afterId?: string | null
}

/**
 * Per ogni documento ancora senza `metadata.audit_pass2_at` (cioè non è mai
 * stato auditato dall'AI moderna): scarica file, chiama Gemini Vision per
 * classificare tipo + estrarre fornitore_suggerito, prova il match nel DB
 * fornitori della sede e applica solo se confidenza ≥ AUTO_APPLY_MIN.
 */
export async function auditAndFixWithAi(
  service: SupabaseClient,
  opts: Pass2Opts = {},
): Promise<AuditBatchResult> {
  const batchSize = Math.min(Math.max(opts.batchSize ?? 5, 1), 10)
  const result: AuditBatchResult = {
    phase: 'ai',
    checked: 0,
    fornitore_fixed: 0,
    tipo_fixed: 0,
    flagged_for_review: 0,
    unchanged: 0,
    errors: 0,
    has_more: false,
    changes: [],
    remaining_estimate: 0,
  }

  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error('GEMINI_API_KEY non configurata')
  }

  let q = service
    .from('documenti_da_processare')
    .select(DOC_SELECT)
    .not('file_url', 'is', null)
    .not('file_url', 'eq', '')
    .order('id', { ascending: true })

  if (!opts.force) {
    q = q.is('metadata->>audit_pass2_at', null) as typeof q
  }
  if (opts.sedeId) {
    q = q.eq('sede_id', opts.sedeId) as typeof q
  }
  q = applyDocBatchCursor(q, opts.afterId)

  const { data, error } = await q.limit(batchSize).returns<DocRow[]>()

  if (error) {
    logger.error('[audit-and-fix:pass2] fetch error:', error.message)
    result.errors = 1
    return result
  }

  const remaining = await countRemaining(service, opts.sedeId ?? null, 'pass2', !!opts.force)
  result.remaining_estimate = remaining

  const docs = data ?? []
  if (!docs.length) return result

  for (const doc of docs) {
    result.checked++
    try {
      const change = await applyAiFix(service, doc)
      if (change === 'flagged') result.flagged_for_review++
      else if (change) {
        result.changes.push(change)
        if (change.fornitore_id_before !== change.fornitore_id_after) result.fornitore_fixed++
        if (change.tipo_before !== change.tipo_after) result.tipo_fixed++
      } else {
        result.unchanged++
      }
    } catch (e) {
      result.errors++
      logger.error('[audit-and-fix:pass2] doc', doc.id, e)
    }
  }

  result.next_after_id = docs[docs.length - 1]?.id ?? null
  result.has_more = docs.length === batchSize
  return result
}

async function applyAiFix(
  service: SupabaseClient,
  doc: DocRow,
): Promise<AuditDocChange | 'flagged' | null> {
  const meta = sanitizeMetadata(doc.metadata)

  if (!doc.file_url?.trim()) {
    await stampPass2(service, doc.id, meta, { skipped_reason: 'no_file_url' })
    return null
  }

  const suggestion = await classifyDocumentWithGemini(service, {
    id: doc.id,
    file_url: doc.file_url,
    file_name: doc.file_name,
    content_type: doc.content_type,
  })

  if (suggestion.error) {
    await stampPass2(service, doc.id, meta, {
      skipped_reason: 'gemini_error',
      gemini_error: suggestion.error,
    })
    return null
  }

  const conf = clamp01(suggestion.confidenza)
  const tipoNorm = mapAiTipoToPendingKind(suggestion.tipo_suggerito)
  const currentKind = stringOrNull(meta.pending_kind)

  let suggestedFornitoreId: string | null = null
  let suggestedFornitoreSource: string | null = null

  if (suggestion.fornitore_suggerito && doc.sede_id) {
    const found = await resolveFornitoreByPartialNameEnhanced(
      service,
      suggestion.fornitore_suggerito,
      doc.sede_id,
    )
    if (found?.id) {
      suggestedFornitoreId = found.id
      suggestedFornitoreSource = 'ai_ragione_sociale'
    }
  }

  const updatedMeta: Record<string, unknown> = {
    ...meta,
    audit_pass2_at: new Date().toISOString(),
    ai_classified_at: new Date().toISOString(),
    ai_tipo_suggerito: suggestion.tipo_suggerito,
    ai_fornitore_suggerito: suggestion.fornitore_suggerito,
    ai_confidenza: conf,
  }

  const updates: Record<string, unknown> = { metadata: updatedMeta }

  let fornitoreChanged = false
  let tipoChanged = false
  let flagged = false

  // Tipi specifici e affidabili (vincono su qualsiasi AI-altro/comunicazione).
  const SPECIFIC_KINDS = new Set([
    'fattura',
    'bolla',
    'nota_credito',
    'statement',
    'ordine',
  ])
  // Tipi "vaghi" che l'AI usa come fallback quando non riesce a classificare meglio.
  const VAGUE_KINDS = new Set(['comunicazione', 'listino', 'altro'])

  // Tipo: applica solo se conf alta E differente E non è un downgrade da specifico a vago.
  // Caso reale che ci ha bruciato: AI ritornava 'altro' → mappato a 'comunicazione' →
  // sostituiva 'bolla'/'fattura'/'ordine' (più affidabili). Le regressioni erano enormi.
  const aiSuggestsDowngrade =
    !!tipoNorm && VAGUE_KINDS.has(tipoNorm) && !!currentKind && SPECIFIC_KINDS.has(currentKind)

  if (
    conf >= AUDIT_AI_AUTO_APPLY_MIN_CONFIDENCE &&
    tipoNorm &&
    tipoNorm !== currentKind &&
    !aiSuggestsDowngrade
  ) {
    updatedMeta.pending_kind = tipoNorm
    if (tipoNorm === 'statement') updates.is_statement = true
    tipoChanged = true
  }

  // Fornitore: applica solo se match certo + conf alta + diverso.
  // Safeguard extra: se il match attuale è 'email' (mittente verificato), una
  // sovrascrittura via AI deve avere conf >= 0.9 (più stringente) perché l'email
  // è in genere il segnale più affidabile.
  const subjectFornitore = await resolveFornitoreFromStatementSubject(service, {
    sedeId: doc.sede_id,
    oggetto_mail: doc.oggetto_mail,
    metadata: meta,
    mittente: doc.mittente,
  })

  if (subjectFornitore?.id && subjectFornitore.id !== doc.fornitore_id) {
    updates.fornitore_id = subjectFornitore.id
    updatedMeta.matched_by = 'statement_subject'
    suggestedFornitoreId = subjectFornitore.id
    fornitoreChanged = true
  } else {
    const currentFornitoreLocked =
      typeof meta.matched_by === 'string' &&
      (meta.matched_by === 'email' || meta.matched_by === 'piva')
    const fornitoreThreshold = currentFornitoreLocked
      ? Math.max(AUDIT_AI_AUTO_APPLY_MIN_CONFIDENCE, 0.95)
      : AUDIT_AI_AUTO_APPLY_MIN_CONFIDENCE

    if (
      suggestedFornitoreId &&
      suggestedFornitoreId !== doc.fornitore_id &&
      conf >= fornitoreThreshold
    ) {
      updates.fornitore_id = suggestedFornitoreId
      updatedMeta.matched_by = suggestedFornitoreSource ?? 'ai'
      fornitoreChanged = true
    }
  }

  // Se l'AI suggerisce qualcosa di diverso ma con bassa confidenza, segna per revisione
  // umana (solo se siamo in stato terminale come associato/scartato — segnaliamo
  // l'incoerenza ma non spostiamo gli stati pesanti).
  const aiDisagreesLow =
    !fornitoreChanged &&
    !tipoChanged &&
    ((suggestedFornitoreId &&
      suggestedFornitoreId !== doc.fornitore_id &&
      conf < AUDIT_AI_AUTO_APPLY_MIN_CONFIDENCE) ||
      (tipoNorm && tipoNorm !== currentKind && conf < AUDIT_AI_AUTO_APPLY_MIN_CONFIDENCE))

  if (aiDisagreesLow) {
    updatedMeta.audit_disagreement = {
      ai_tipo: tipoNorm,
      current_kind: currentKind,
      ai_fornitore_id: suggestedFornitoreId,
      current_fornitore_id: doc.fornitore_id,
      confidenza: conf,
    }
    flagged = true
  }

  const { error: updErr } = await service
    .from('documenti_da_processare')
    .update(updates)
    .eq('id', doc.id)

  if (updErr) throw new Error(updErr.message)

  if (fornitoreChanged && suggestedFornitoreId) {
    await propagateFornitoreFromPendingDoc(service, {
      fornitoreId: suggestedFornitoreId,
      fattura_id: doc.fattura_id,
      bolla_id: doc.bolla_id,
      file_url: doc.file_url,
    })
  }

  if (!fornitoreChanged && !tipoChanged) {
    return flagged ? 'flagged' : null
  }

  return {
    doc_id: doc.id,
    fornitore_id_before: doc.fornitore_id,
    fornitore_id_after: fornitoreChanged ? suggestedFornitoreId : doc.fornitore_id,
    tipo_before: currentKind,
    tipo_after: tipoChanged ? tipoNorm : currentKind,
    fattura_id: doc.fattura_id,
    bolla_id: doc.bolla_id,
    reason: `ai conf=${conf.toFixed(2)} ${buildReason(fornitoreChanged, tipoChanged, false)}`,
  }
}

async function stampPass2(
  service: SupabaseClient,
  docId: string,
  baseMeta: Record<string, unknown>,
  extra: Record<string, unknown>,
): Promise<void> {
  const meta = {
    ...baseMeta,
    audit_pass2_at: new Date().toISOString(),
    ...extra,
  }
  const { error } = await service
    .from('documenti_da_processare')
    .update({ metadata: meta })
    .eq('id', docId)
  if (error) logger.error('[audit-and-fix:pass2] stamp err', docId, error.message)
}

/** Checkpoint unico per «Completo + AI»: merge su metadata esistente. */
async function stampCompletoCheckpoint(service: SupabaseClient, docId: string): Promise<void> {
  const { data, error: fetchErr } = await service
    .from('documenti_da_processare')
    .select('metadata')
    .eq('id', docId)
    .maybeSingle()

  if (fetchErr) {
    logger.error('[audit-and-fix:completo] checkpoint fetch err', docId, fetchErr.message)
    return
  }

  const meta = sanitizeMetadata(data?.metadata)
  meta.audit_completo_at = new Date().toISOString()

  const { error } = await service
    .from('documenti_da_processare')
    .update({ metadata: meta })
    .eq('id', docId)

  if (error) logger.error('[audit-and-fix:completo] checkpoint stamp err', docId, error.message)
}

// ── Pass 3: cleanup misclassified ─────────────────────────────────────────────
//
// Generalizzato: corregge le incoerenze tra `metadata.pending_kind` (la verità
// determinata dalle pass1/pass2 o riclassificazioni successive) e dove punta
// effettivamente la riga (`bolla_id`, `fattura_id`, voce in `conferme_ordine`).
//
// Cinque categorie di azioni:
//  A. delete_orphan_bolla           — bolla orfana, pending_kind ∈ {ordine,statement,listino,comunicazione}
//  B. delete_orphan_fattura         — fattura orfana, pending_kind ∈ {ordine,statement,listino,comunicazione,bolla}
//  C. promote_bolla_to_fattura      — bolla con pending_kind='fattura' (era una vera fattura travestita)
//  D. demote_fattura_to_bolla       — fattura con pending_kind='bolla'  (era un DDT importato come fattura)
//  E. delete_orphan_conferma_ordine — voce in conferme_ordine ma il documento sorgente non è più 'ordine'
//
// Idempotente: marca `metadata.audit_cleanup_at`. In dry-run ritorna solo
// l'elenco delle azioni proposte senza modificare nulla.

type Pass3Opts = {
  sedeId?: string | null
  /** Quanti documenti per ciclo. Default 25. */
  batchSize?: number
  /** Se true: solo report, nessuna modifica. Default false. */
  dryRun?: boolean
  /** Riprocessa anche già marcati `audit_cleanup_at`. */
  force?: boolean
}

const PENDING_KIND_NEEDS_BOLLA = 'bolla'
const PENDING_KIND_NEEDS_FATTURA = 'fattura'
const PENDING_KIND_NEEDS_ORDINE = 'ordine'
/** Tipi che non corrispondono a una riga in bolle/fatture/conferme_ordine: vanno solo in coda. */
const PENDING_KIND_NO_TARGET = new Set(['statement', 'listino', 'comunicazione', 'nota_credito'])

export async function auditAndCleanupMisclassified(
  service: SupabaseClient,
  opts: Pass3Opts = {},
): Promise<AuditBatchResult> {
  const batchSize = Math.min(Math.max(opts.batchSize ?? 25, 1), 100)
  const dryRun = opts.dryRun === true

  const result: AuditBatchResult = {
    phase: 'cleanup_misclassified',
    checked: 0,
    fornitore_fixed: 0,
    tipo_fixed: 0,
    flagged_for_review: 0,
    unchanged: 0,
    errors: 0,
    has_more: false,
    changes: [],
    cleanup_actions: [],
    remaining_estimate: 0,
    dry_run: dryRun,
  }

  // Query A/B/C/D: documenti con bolla_id o fattura_id puntanti, con incoerenza
  // potenziale tra pending_kind e target. Idempotenza tramite audit_cleanup_at.
  let q = service
    .from('documenti_da_processare')
    .select(`${DOC_SELECT}, fornitori(nome)`)
    .or('bolla_id.not.is.null,fattura_id.not.is.null')
    .order('created_at', { ascending: false })

  if (!opts.force && !dryRun) {
    q = q.is('metadata->>audit_cleanup_at', null) as typeof q
  }
  if (opts.sedeId) {
    q = q.eq('sede_id', opts.sedeId) as typeof q
  }

  const { data, error } = await q
    .limit(batchSize)
    .returns<(DocRow & { fornitori?: { nome?: string } | null })[]>()

  if (error) {
    logger.error('[audit-and-fix:cleanup] fetch error:', error.message)
    result.errors = 1
    return result
  }

  const remaining = await countRemaining(service, opts.sedeId ?? null, 'cleanup', !!opts.force || dryRun)
  result.remaining_estimate = remaining

  const docs = data ?? []
  if (docs.length) {
    for (const doc of docs) {
      result.checked++
      try {
        const actions = await applyCleanupGeneralized(service, doc, dryRun)
        for (const a of actions) result.cleanup_actions!.push(a)
        if (actions.length === 0) result.unchanged++
      } catch (e) {
        result.errors++
        logger.error('[audit-and-fix:cleanup] doc', doc.id, e)
      }
    }
  }

  result.has_more = remaining > docs.length
  return result
}

/**
 * Per un singolo `documenti_da_processare`, decide quali azioni di cleanup
 * applicare in base alla coerenza tra `metadata.pending_kind` e i target
 * collegati (`bolla_id` / `fattura_id`).
 *
 * Idempotente: stampa sempre `audit_cleanup_at` per impedire ri-elaborazione.
 */
async function applyCleanupGeneralized(
  service: SupabaseClient,
  doc: DocRow & { fornitori?: { nome?: string } | null },
  dryRun: boolean,
): Promise<AuditCleanupAction[]> {
  const meta = sanitizeMetadata(doc.metadata)
  const blob = `${doc.oggetto_mail ?? ''}\n${doc.file_name ?? ''}`

  // ── Decidi il pending_kind effettivo ─────────────────────────────────────
  // Quando `metadata.pending_kind` storato sembra incoerente con OCR + segnali
  // testuali (subject/filename), preferiamo la categoria che ha il consenso
  // di più segnali. Esempio: pending_kind=fattura ma OCR=bolla + subject="Sales
  // Delivery Note" → corretto è bolla (pending_kind sbagliato).
  const storedKind = stringOrNull(meta.pending_kind)
  const ocrTipoNorm = normalizeTipoDocumento(stringOrNull(meta.tipo_documento))
  const ocrToPending: Record<string, string> = {
    ordine: 'ordine',
    estratto_conto: 'statement',
    nota_credito: 'nota_credito',
    fattura: 'fattura',
    bolla_ddt: 'bolla',
    comunicazione: 'comunicazione',
  }
  const ocrPendingKind = ocrTipoNorm ? ocrToPending[ocrTipoNorm] : null

  // Pattern testuali forti
  const blobLower = blob.toLowerCase()
  const subjectIsBolla = /\b(delivery\s+note|ddt|bolla|sales\s+delivery)\b/.test(blobLower)
  const subjectIsFattura =
    /\b(invoice|fattura|tax\s+invoice|sales\s+invoice|a\/r\s+invoice)\b/.test(blobLower) &&
    !/sales\s+delivery/.test(blobLower)
  const subjectIsStatement = /\b(statement|estratto\s+conto)\b/.test(blobLower)
  const subjectIsOrdine = /\b(order\s+confirmation|conferma\s+ordine|sales\s+order|purchase\s+order)\b/.test(
    blobLower,
  )

  // Voting:
  //   • subject/filename con pattern esplicito → +2 (segnale molto forte: l'utente
  //     o il fornitore l'hanno scritto deliberatamente)
  //   • OCR su tipi specifici (ordine/statement/nota_credito) → +2
  //   • OCR su tipi generici (fattura/bolla_ddt/comunicazione) → +1
  //   • pending_kind salvato → +1
  //
  // Casi tipici risolti:
  //   - Donovan OSTE01 (subject neutro, OCR=ordine) → ordine 2 vs fattura 1 → corretto a ordine
  //   - Hildon 50228137 (subject="Delivery Note", OCR=ordine) → bolla 2 vs ordine 2 → tie → mantiene
  //     pending_kind salvato (=bolla per uno dei doc, undefined per gli altri).
  //     Override avviene solo se >= 2 e supera storedKind, altrimenti no-op.
  //   - Hildon 70220795 (subject="A/R Invoice", OCR=fattura) → fattura 4 (subject 2 + ocr 1 + stored 1)
  const votes: Record<string, number> = {}
  const bump = (k: string | null | undefined, w = 1) => {
    if (k) votes[k] = (votes[k] ?? 0) + w
  }
  const TRUSTED_SPECIFIC_OCR = new Set(['ordine', 'statement', 'nota_credito'])
  const ocrIsSpecific = !!ocrPendingKind && TRUSTED_SPECIFIC_OCR.has(ocrPendingKind)
  bump(ocrPendingKind, ocrIsSpecific ? 2 : 1)
  bump(storedKind, 1)
  if (subjectIsBolla) bump('bolla', 2)
  if (subjectIsFattura) bump('fattura', 2)
  if (subjectIsStatement) bump('statement', 2)
  if (subjectIsOrdine) bump('ordine', 2)

  // Trova il vincitore E controlla se c'è un tie (≥ 2 candidati con stesso bestVotes).
  let bestKind: string | null = null
  let bestVotes = 0
  for (const [k, v] of Object.entries(votes)) {
    if (v > bestVotes) {
      bestKind = k
      bestVotes = v
    }
  }
  let tied = false
  if (bestKind != null) {
    let countAtBest = 0
    for (const v of Object.values(votes)) {
      if (v === bestVotes) countAtBest++
    }
    if (countAtBest > 1) tied = true
  }

  // Override solo se:
  //  • c'è un vincitore unico (no tie)
  //  • il vincitore differisce da pending_kind salvato
  //  • ha margine ≥ 2 (escude segnali deboli)
  // In tie o quando i segnali sono insufficienti, mantieni il pending_kind salvato.
  // Se storedKind è null e c'è tie, non agire (segnali contraddittori).
  const useOcrOverride =
    !tied && bestKind != null && bestKind !== storedKind && bestVotes >= 2
  const pendingKind = useOcrOverride ? bestKind : storedKind

  // Se i segnali sono in tie e storedKind è null, considera "indeterminato":
  // non eseguire alcuna azione, marca come review.
  const indeterminate = tied && storedKind == null

  const actions: AuditCleanupAction[] = []

  // Sicurezza: NON toccare se la bolla è linkata in fattura_bolle
  if (doc.bolla_id) {
    const { data: links } = await service
      .from('fattura_bolle')
      .select('fattura_id')
      .eq('bolla_id', doc.bolla_id)
      .limit(1)
    if (Array.isArray(links) && links.length > 0) {
      if (!dryRun) {
        await stampCleanup(service, doc.id, meta, { skipped_reason: 'bolla_in_fattura_bolle' })
      }
      return []
    }
  }

  // Indeterminato (tie + nessun pending_kind salvato): segnala e non agire.
  if (indeterminate) {
    if (!dryRun) {
      await stampCleanup(service, doc.id, meta, {
        skipped_reason: 'tie_no_stored_kind',
        votes,
      })
    }
    return []
  }

  // Se abbiamo overrideato il pending_kind, marca il fix come parte del cleanup
  if (useOcrOverride && !dryRun) {
    const newMeta = { ...meta, pending_kind: pendingKind }
    if (pendingKind === 'statement') {
      await service
        .from('documenti_da_processare')
        .update({ metadata: newMeta, is_statement: true })
        .eq('id', doc.id)
    } else {
      await service
        .from('documenti_da_processare')
        .update({ metadata: newMeta })
        .eq('id', doc.id)
    }
    // aggiorna meta locale per i passi successivi
    meta.pending_kind = pendingKind
  }

  // ── Caso A: bolla orfana con pending_kind=ordine + pattern Order Confirmation ─
  if (
    pendingKind === PENDING_KIND_NEEDS_ORDINE &&
    (doc.bolla_id || doc.fattura_id) &&
    ORDER_CONFIRMATION_PATTERN.test(blob)
  ) {
    const action = await deleteBolleFattureForOrdineDoc(service, doc, meta, dryRun)
    if (action) actions.push(action)
    return actions
  }

  // ── Caso A2: ordine senza pattern OC (OCR-trusted) ──────────────────────
  // Se pending_kind=ordine ma il pattern testuale non c'è, questa è la situazione
  // del documento Donovan OSTE01 (Sales Order Confirmation senza la stringa
  // letterale nel subject). L'OCR ha letto il contenuto e classificato come ordine.
  // → cancella la bolla/fattura orfana.
  if (
    pendingKind === PENDING_KIND_NEEDS_ORDINE &&
    (doc.bolla_id || doc.fattura_id) &&
    !ORDER_CONFIRMATION_PATTERN.test(blob)
  ) {
    if (doc.bolla_id) {
      const action = await deleteOrphanBolla(service, doc, meta, 'ordine', dryRun)
      if (action) actions.push(action)
    } else if (doc.fattura_id) {
      const action = await deleteOrphanFattura(service, doc, meta, 'ordine', dryRun)
      if (action) actions.push(action)
    }
    return actions
  }

  // ── Caso B: bolla con pending_kind che NON dovrebbe essere bolla ─────────
  if (doc.bolla_id && pendingKind && pendingKind !== PENDING_KIND_NEEDS_BOLLA) {
    if (pendingKind === PENDING_KIND_NEEDS_FATTURA) {
      // Caso C: promuovi a fattura
      const action = await promoteBollaToFattura(service, doc, meta, dryRun)
      if (action) actions.push(action)
    } else if (
      pendingKind === PENDING_KIND_NEEDS_ORDINE ||
      PENDING_KIND_NO_TARGET.has(pendingKind)
    ) {
      // ordine senza pattern OC, statement, listino, comunicazione, nota_credito → cancella bolla
      const action = await deleteOrphanBolla(service, doc, meta, pendingKind, dryRun)
      if (action) actions.push(action)
    } else {
      // pending_kind sconosciuto: marca come visto ma non agire
      if (!dryRun) {
        await stampCleanup(service, doc.id, meta, {
          skipped_reason: `unknown_pending_kind:${pendingKind}`,
        })
      }
    }
    return actions
  }

  // ── Caso D: fattura con pending_kind che NON dovrebbe essere fattura ─────
  if (doc.fattura_id && pendingKind && pendingKind !== PENDING_KIND_NEEDS_FATTURA) {
    if (pendingKind === PENDING_KIND_NEEDS_BOLLA) {
      // Demote: crea bolla, cancella fattura
      const action = await demoteFatturaToBolla(service, doc, meta, dryRun)
      if (action) actions.push(action)
    } else if (
      pendingKind === PENDING_KIND_NEEDS_ORDINE ||
      PENDING_KIND_NO_TARGET.has(pendingKind)
    ) {
      const action = await deleteOrphanFattura(service, doc, meta, pendingKind, dryRun)
      if (action) actions.push(action)
    } else {
      if (!dryRun) {
        await stampCleanup(service, doc.id, meta, {
          skipped_reason: `unknown_pending_kind:${pendingKind}`,
        })
      }
    }
    return actions
  }

  // Niente da fare: pending_kind coerente. Marca come visto.
  if (!dryRun) {
    await stampCleanup(service, doc.id, meta, { skipped_reason: 'consistent' })
  }
  return []
}

// ─────── Azione: cancella bolle/fatture per Order Confirmation (Caso A) ─────

async function deleteBolleFattureForOrdineDoc(
  service: SupabaseClient,
  doc: DocRow & { fornitori?: { nome?: string } | null },
  meta: Record<string, unknown>,
  dryRun: boolean,
): Promise<AuditCleanupAction | null> {
  const action: AuditCleanupAction = {
    doc_id: doc.id,
    fornitore_nome: doc.fornitori?.nome ?? null,
    oggetto_mail: doc.oggetto_mail,
    file_name: doc.file_name,
    pending_kind: 'ordine',
    action_kind: doc.bolla_id ? 'delete_orphan_bolla' : 'delete_orphan_fattura',
    deleted_bolla_id: null,
    deleted_fattura_id: null,
    deleted_conferma_ordine_id: null,
    deleted_orphan_fattura_ids: [],
    created_fattura_id: null,
    created_bolla_id: null,
    applied: false,
  }

  // Trova fatture orfane che puntano alla bolla
  let orphanFatturaIds: string[] = []
  if (doc.bolla_id) {
    const { data: orphans } = await service
      .from('fatture')
      .select('id')
      .eq('bolla_id', doc.bolla_id)
    if (Array.isArray(orphans)) {
      orphanFatturaIds = orphans.map((o: { id: string }) => o.id)
    }
  }

  if (dryRun) {
    action.deleted_bolla_id = doc.bolla_id
    action.deleted_fattura_id = doc.fattura_id
    action.deleted_orphan_fattura_ids = orphanFatturaIds
    return action
  }

  if (orphanFatturaIds.length > 0) {
    const { error } = await service.from('fatture').delete().in('id', orphanFatturaIds)
    if (error) throw new Error(`fatture orfane: ${error.message}`)
    action.deleted_orphan_fattura_ids = orphanFatturaIds
  }
  if (doc.bolla_id) {
    const { error } = await service.from('bolle').delete().eq('id', doc.bolla_id)
    if (error) throw new Error(`bolla: ${error.message}`)
    action.deleted_bolla_id = doc.bolla_id
  }
  if (doc.fattura_id && !orphanFatturaIds.includes(doc.fattura_id)) {
    const { error } = await service.from('fatture').delete().eq('id', doc.fattura_id)
    if (error) throw new Error(`fattura: ${error.message}`)
    action.deleted_fattura_id = doc.fattura_id
  }

  await markCleanupApplied(service, doc, meta, 'order_confirmation_purged', {
    bolla_id: action.deleted_bolla_id,
    fattura_id: action.deleted_fattura_id,
    orphan_fattura_ids: action.deleted_orphan_fattura_ids,
  })
  action.applied = true
  return action
}

// ─────── Azione: cancella bolla orfana (Caso B) ─────────────────────────────

async function deleteOrphanBolla(
  service: SupabaseClient,
  doc: DocRow & { fornitori?: { nome?: string } | null },
  meta: Record<string, unknown>,
  pendingKind: string,
  dryRun: boolean,
): Promise<AuditCleanupAction | null> {
  const action: AuditCleanupAction = {
    doc_id: doc.id,
    fornitore_nome: doc.fornitori?.nome ?? null,
    oggetto_mail: doc.oggetto_mail,
    file_name: doc.file_name,
    pending_kind: pendingKind,
    action_kind: 'delete_orphan_bolla',
    deleted_bolla_id: null,
    deleted_fattura_id: null,
    deleted_conferma_ordine_id: null,
    deleted_orphan_fattura_ids: [],
    created_fattura_id: null,
    created_bolla_id: null,
    applied: false,
  }

  if (dryRun) {
    action.deleted_bolla_id = doc.bolla_id
    return action
  }

  if (doc.bolla_id) {
    const { error } = await service.from('bolle').delete().eq('id', doc.bolla_id)
    if (error) throw new Error(`bolla: ${error.message}`)
    action.deleted_bolla_id = doc.bolla_id
  }
  await markCleanupApplied(service, doc, meta, `delete_orphan_bolla_${pendingKind}`, {
    bolla_id: action.deleted_bolla_id,
  })
  action.applied = true
  return action
}

// ─────── Azione: cancella fattura orfana (Caso B/D) ─────────────────────────

async function deleteOrphanFattura(
  service: SupabaseClient,
  doc: DocRow & { fornitori?: { nome?: string } | null },
  meta: Record<string, unknown>,
  pendingKind: string,
  dryRun: boolean,
): Promise<AuditCleanupAction | null> {
  const action: AuditCleanupAction = {
    doc_id: doc.id,
    fornitore_nome: doc.fornitori?.nome ?? null,
    oggetto_mail: doc.oggetto_mail,
    file_name: doc.file_name,
    pending_kind: pendingKind,
    action_kind: 'delete_orphan_fattura',
    deleted_bolla_id: null,
    deleted_fattura_id: null,
    deleted_conferma_ordine_id: null,
    deleted_orphan_fattura_ids: [],
    created_fattura_id: null,
    created_bolla_id: null,
    applied: false,
  }

  if (dryRun) {
    action.deleted_fattura_id = doc.fattura_id
    return action
  }

  if (doc.fattura_id) {
    const { error } = await service.from('fatture').delete().eq('id', doc.fattura_id)
    if (error) throw new Error(`fattura: ${error.message}`)
    action.deleted_fattura_id = doc.fattura_id
  }
  await markCleanupApplied(service, doc, meta, `delete_orphan_fattura_${pendingKind}`, {
    fattura_id: action.deleted_fattura_id,
  })
  action.applied = true
  return action
}

// ─────── Azione: promuovi bolla → fattura (Caso C) ──────────────────────────

async function promoteBollaToFattura(
  service: SupabaseClient,
  doc: DocRow & { fornitori?: { nome?: string } | null },
  meta: Record<string, unknown>,
  dryRun: boolean,
): Promise<AuditCleanupAction | null> {
  const action: AuditCleanupAction = {
    doc_id: doc.id,
    fornitore_nome: doc.fornitori?.nome ?? null,
    oggetto_mail: doc.oggetto_mail,
    file_name: doc.file_name,
    pending_kind: 'fattura',
    action_kind: 'promote_bolla_to_fattura',
    deleted_bolla_id: null,
    deleted_fattura_id: null,
    deleted_conferma_ordine_id: null,
    deleted_orphan_fattura_ids: [],
    created_fattura_id: null,
    created_bolla_id: null,
    applied: false,
  }

  if (!doc.bolla_id) return null

  // Carica la bolla per copiare i dati nella nuova fattura
  const { data: bolla, error: errLoad } = await service
    .from('bolle')
    .select('id, fornitore_id, sede_id, data, file_url, importo, numero_bolla')
    .eq('id', doc.bolla_id)
    .maybeSingle()
  if (errLoad) throw new Error(`load bolla: ${errLoad.message}`)
  if (!bolla) {
    // Bolla già rimossa: marca come visto e basta
    if (!dryRun) {
      await stampCleanup(service, doc.id, meta, { skipped_reason: 'bolla_not_found' })
    }
    return null
  }

  if (dryRun) {
    action.deleted_bolla_id = doc.bolla_id
    return action
  }

  // 0. Verifica se esiste già una fattura con stessi numero/data/fornitore/sede/importo:
  // In quel caso non creiamo un duplicato — riusiamo quella preesistente.
  let existingFatturaId: string | null = null
  const numeroNorm = bolla.numero_bolla?.trim() || null
  if (numeroNorm) {
    const { data: existing } = await service
      .from('fatture')
      .select('id')
      .eq('fornitore_id', bolla.fornitore_id)
      .eq('numero_fattura', numeroNorm)
      .eq('data', bolla.data)
      .eq('sede_id', bolla.sede_id)
      .order('creato_il', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (existing?.id) existingFatturaId = existing.id
  }

  let fatturaId: string
  if (existingFatturaId) {
    fatturaId = existingFatturaId
    // Non aggiungiamo `created_fattura_id`: non è stata creata adesso
  } else {
    // 1. Crea fattura
    const fatturaPayload: Record<string, unknown> = {
      fornitore_id: bolla.fornitore_id,
      sede_id: bolla.sede_id,
      data: bolla.data,
      file_url: bolla.file_url,
      importo: bolla.importo,
      bolla_id: null,
      numero_fattura: numeroNorm,
    }
    const { data: ins, error: errIns } = await service
      .from('fatture')
      .insert([fatturaPayload])
      .select('id')
      .single()
    if (errIns) throw new Error(`promote insert: ${errIns.message}`)
    fatturaId = ins!.id
    action.created_fattura_id = fatturaId
  }

  // 2. Cancella la bolla
  const { error: errDel } = await service.from('bolle').delete().eq('id', doc.bolla_id)
  if (errDel) {
    if (!existingFatturaId && action.created_fattura_id) {
      await service.from('fatture').delete().eq('id', action.created_fattura_id)
      action.created_fattura_id = null
    }
    throw new Error(`promote delete bolla: ${errDel.message}`)
  }
  action.deleted_bolla_id = doc.bolla_id

  // 3. Aggiorna documenti_da_processare → fattura_id, bolla_id=null
  await markCleanupApplied(
    service,
    { ...doc, bolla_id: null, fattura_id: fatturaId },
    meta,
    'promoted_bolla_to_fattura',
    {
      bolla_id_deleted: action.deleted_bolla_id,
      fattura_id_linked: fatturaId,
      reused_existing: !!existingFatturaId,
    },
  )
  action.applied = true
  return action
}

// ─────── Azione: declassa fattura → bolla (Caso D inverso) ──────────────────

async function demoteFatturaToBolla(
  service: SupabaseClient,
  doc: DocRow & { fornitori?: { nome?: string } | null },
  meta: Record<string, unknown>,
  dryRun: boolean,
): Promise<AuditCleanupAction | null> {
  const action: AuditCleanupAction = {
    doc_id: doc.id,
    fornitore_nome: doc.fornitori?.nome ?? null,
    oggetto_mail: doc.oggetto_mail,
    file_name: doc.file_name,
    pending_kind: 'bolla',
    action_kind: 'demote_fattura_to_bolla',
    deleted_bolla_id: null,
    deleted_fattura_id: null,
    deleted_conferma_ordine_id: null,
    deleted_orphan_fattura_ids: [],
    created_fattura_id: null,
    created_bolla_id: null,
    applied: false,
  }

  if (!doc.fattura_id) return null

  const { data: fattura, error: errLoad } = await service
    .from('fatture')
    .select('id, fornitore_id, sede_id, data, file_url, importo, numero_fattura')
    .eq('id', doc.fattura_id)
    .maybeSingle()
  if (errLoad) throw new Error(`load fattura: ${errLoad.message}`)
  if (!fattura) {
    if (!dryRun) {
      await stampCleanup(service, doc.id, meta, { skipped_reason: 'fattura_not_found' })
    }
    return null
  }

  if (dryRun) {
    action.deleted_fattura_id = doc.fattura_id
    return action
  }

  // 0. Verifica preesistente bolla identica (same numero+data+fornitore+sede)
  let existingBollaId: string | null = null
  const numeroNorm = fattura.numero_fattura?.trim() || null
  if (numeroNorm) {
    const { data: existing } = await service
      .from('bolle')
      .select('id')
      .eq('fornitore_id', fattura.fornitore_id)
      .eq('numero_bolla', numeroNorm)
      .eq('data', fattura.data)
      .eq('sede_id', fattura.sede_id)
      .order('creato_il', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (existing?.id) existingBollaId = existing.id
  }

  let bollaId: string
  if (existingBollaId) {
    bollaId = existingBollaId
  } else {
    const bollaPayload: Record<string, unknown> = {
      fornitore_id: fattura.fornitore_id,
      sede_id: fattura.sede_id,
      data: fattura.data,
      file_url: fattura.file_url,
      importo: fattura.importo,
      numero_bolla: numeroNorm,
      stato: 'in attesa',
    }
    const { data: ins, error: errIns } = await service
      .from('bolle')
      .insert([bollaPayload])
      .select('id')
      .single()
    if (errIns) throw new Error(`demote insert: ${errIns.message}`)
    bollaId = ins!.id
    action.created_bolla_id = bollaId
  }

  const { error: errDel } = await service.from('fatture').delete().eq('id', doc.fattura_id)
  if (errDel) {
    if (!existingBollaId && action.created_bolla_id) {
      await service.from('bolle').delete().eq('id', action.created_bolla_id)
      action.created_bolla_id = null
    }
    throw new Error(`demote delete fattura: ${errDel.message}`)
  }
  action.deleted_fattura_id = doc.fattura_id

  await markCleanupApplied(
    service,
    { ...doc, bolla_id: bollaId, fattura_id: null },
    meta,
    'demoted_fattura_to_bolla',
    {
      fattura_id_deleted: action.deleted_fattura_id,
      bolla_id_linked: bollaId,
      reused_existing: !!existingBollaId,
    },
  )
  action.applied = true
  return action
}

// ─────── Helpers cleanup ────────────────────────────────────────────────────

async function markCleanupApplied(
  service: SupabaseClient,
  doc: DocRow,
  baseMeta: Record<string, unknown>,
  actionKey: string,
  details: Record<string, unknown>,
): Promise<void> {
  const newMeta: Record<string, unknown> = {
    ...baseMeta,
    audit_cleanup_at: new Date().toISOString(),
    audit_cleanup_action: actionKey,
    audit_cleanup_details: details,
  }
  // Stato finale: se promoted/demoted, lo stato resta `associato` (il documento ora
  // ha un nuovo target). Se delete_*, va in `scartato`.
  const movedToNewTarget =
    actionKey === 'promoted_bolla_to_fattura' || actionKey === 'demoted_fattura_to_bolla'
  const updates: Record<string, unknown> = {
    metadata: newMeta,
    bolla_id: doc.bolla_id ?? null,
    fattura_id: doc.fattura_id ?? null,
  }
  if (!movedToNewTarget) {
    updates.stato = 'scartato'
    updates.bolla_id = null
    updates.fattura_id = null
    updates.note =
      (doc.note ? doc.note + ' · ' : '') +
      `Pulito automaticamente (${actionKey}) il ${new Date().toISOString().slice(0, 10)}`
  }
  const { error } = await service
    .from('documenti_da_processare')
    .update(updates)
    .eq('id', doc.id)
  if (error) throw new Error(`documento update: ${error.message}`)
}

async function stampCleanup(
  service: SupabaseClient,
  docId: string,
  baseMeta: Record<string, unknown>,
  extra: Record<string, unknown>,
): Promise<void> {
  const meta = {
    ...baseMeta,
    audit_cleanup_at: new Date().toISOString(),
    ...extra,
  }
  const { error } = await service
    .from('documenti_da_processare')
    .update({ metadata: meta })
    .eq('id', docId)
  if (error) logger.error('[audit-and-fix:cleanup] stamp err', docId, error.message)
}

// ─────── Caso E: conferme_ordine "orfane" (file che non sono più ordini) ────
//
// La tabella `conferme_ordine` riceve voci da `/api/documenti-da-processare`
// quando l'utente sceglie "ordine" come tipo. Ma se poi una passata di
// riclassificazione cambia `metadata.pending_kind` a `statement`/`fattura`/...
// la voce in `conferme_ordine` resta orfana. Questa funzione la cancella.

type ConfermeOrdineRow = {
  id: string
  fornitore_id: string | null
  file_url: string | null
  file_name: string | null
  titolo: string | null
  fornitori?: { nome?: string } | null
}

export async function auditAndCleanupOrphanConfermeOrdine(
  service: SupabaseClient,
  opts: { sedeId?: string | null; batchSize?: number; dryRun?: boolean } = {},
): Promise<AuditBatchResult> {
  const batchSize = Math.min(Math.max(opts.batchSize ?? 100, 1), 500)
  const dryRun = opts.dryRun === true

  const result: AuditBatchResult = {
    phase: 'cleanup_conferme_ordine',
    checked: 0,
    fornitore_fixed: 0,
    tipo_fixed: 0,
    flagged_for_review: 0,
    unchanged: 0,
    errors: 0,
    has_more: false,
    changes: [],
    cleanup_actions: [],
    remaining_estimate: 0,
    dry_run: dryRun,
  }

  // Strategia: prendi tutti i documenti_da_processare con pending_kind != ordine
  // e file_url non null. Paginazione per superare il limite Supabase di 1000 righe.
  // Poi join su conferme_ordine per file_url. Per database di ~3000 doc, 3 chiamate.
  const docList: Array<{
    file_url: string
    metadata: Record<string, unknown> | null
    oggetto_mail: string | null
    file_name: string | null
  }> = []
  const docPageSize = 1000
  for (let offset = 0; offset < 5000; offset += docPageSize) {
    let pageQ = service
      .from('documenti_da_processare')
      .select('file_url, metadata, oggetto_mail, file_name')
      .not('file_url', 'is', null)
      .not('file_url', 'eq', '')
      .filter(
        'metadata->>pending_kind',
        'in',
        '(fattura,bolla,statement,nota_credito,listino,comunicazione)',
      )
      .range(offset, offset + docPageSize - 1)
    if (opts.sedeId) {
      pageQ = pageQ.eq('sede_id', opts.sedeId) as typeof pageQ
    }
    const { data: pageDocs, error: pageErr } = await pageQ
    if (pageErr) {
      logger.error('[audit-and-fix:cleanup-co] fetch docs page error:', pageErr.message)
      result.errors++
      break
    }
    if (!pageDocs || pageDocs.length === 0) break
    docList.push(
      ...(pageDocs as Array<{
        file_url: string
        metadata: Record<string, unknown> | null
        oggetto_mail: string | null
        file_name: string | null
      }>),
    )
    if (pageDocs.length < docPageSize) break
  }
  if (!docList.length) return result

  // Mappa per lookup veloce
  const docByUrl = new Map<string, { metadata: Record<string, unknown>; oggetto: string | null; filename: string | null }>()
  for (const d of docList) {
    docByUrl.set(d.file_url, {
      metadata: d.metadata ?? {},
      oggetto: d.oggetto_mail,
      filename: d.file_name,
    })
  }

  // Cerca tutte le CO che hanno questi file_url. Spezzettiamo in chunk da 100
  // per evitare query troppo grandi.
  const urls = Array.from(docByUrl.keys())
  const chunkSize = 100
  const allCO: ConfermeOrdineRow[] = []
  for (let i = 0; i < urls.length; i += chunkSize) {
    const chunk = urls.slice(i, i + chunkSize)
    const { data: rows, error: errCO } = await service
      .from('conferme_ordine')
      .select('id, fornitore_id, file_url, file_name, titolo, fornitori(nome)')
      .in('file_url', chunk)
      .returns<ConfermeOrdineRow[]>()
    if (errCO) {
      logger.error('[audit-and-fix:cleanup-co] fetch CO chunk error:', errCO.message)
      result.errors++
      continue
    }
    if (rows) allCO.push(...rows)
    if (allCO.length >= batchSize) break
  }

  for (const co of allCO.slice(0, batchSize)) {
    result.checked++
    const docInfo = co.file_url ? docByUrl.get(co.file_url) : null
    if (!docInfo) {
      result.unchanged++
      continue
    }
    const pendingKind = stringOrNull(docInfo.metadata.pending_kind)
    if (pendingKind === 'ordine' || pendingKind === null) {
      result.unchanged++
      continue
    }

    const action: AuditCleanupAction = {
      doc_id: 'conferma_ordine:' + co.id,
      fornitore_nome: co.fornitori?.nome ?? null,
      oggetto_mail: docInfo.oggetto,
      file_name: co.file_name ?? docInfo.filename,
      pending_kind: pendingKind,
      action_kind: 'delete_orphan_conferma_ordine',
      deleted_bolla_id: null,
      deleted_fattura_id: null,
      deleted_conferma_ordine_id: co.id,
      deleted_orphan_fattura_ids: [],
      created_fattura_id: null,
      created_bolla_id: null,
      applied: false,
    }

    if (dryRun) {
      result.cleanup_actions!.push(action)
      continue
    }

    try {
      const { error: errDel } = await service.from('conferme_ordine').delete().eq('id', co.id)
      if (errDel) throw new Error(errDel.message)
      action.applied = true
      result.cleanup_actions!.push(action)
    } catch (e) {
      result.errors++
      logger.error('[audit-and-fix:cleanup-co] delete', co.id, e)
    }
  }

  return result
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function getAuditPendingCounts(
  service: SupabaseClient,
  sedeId?: string | null,
): Promise<AuditPendingCounts> {
  let totalQ = service
    .from('documenti_da_processare')
    .select('id', { count: 'exact', head: true })
  if (sedeId) {
    totalQ = totalQ.eq('sede_id', sedeId) as typeof totalQ
  }
  const { count: total } = await totalQ
  const totalN = total ?? 0
  const completoRemaining = await countRemaining(service, sedeId ?? null, 'completo', false)

  return {
    total: totalN,
    pass1_remaining: await countRemaining(service, sedeId ?? null, 'pass1', false),
    pass2_remaining: await countRemaining(service, sedeId ?? null, 'pass2', false),
    completo_remaining: completoRemaining,
    completo_done: Math.max(0, totalN - completoRemaining),
  }
}

async function countRemaining(
  service: SupabaseClient,
  sedeId: string | null,
  pass: 'pass1' | 'pass2' | 'completo' | 'cleanup',
  force: boolean,
): Promise<number> {
  let q = service
    .from('documenti_da_processare')
    .select('id', { count: 'exact', head: true })

  if (pass === 'pass2') {
    q = q.not('file_url', 'is', null).not('file_url', 'eq', '') as typeof q
  }
  if (pass === 'cleanup') {
    // Larga: tutti i doc con bolla_id o fattura_id collegati. La logica di
    // applyCleanupGeneralized decide poi se serve cleanup o solo stamp consistent.
    q = q.or('bolla_id.not.is.null,fattura_id.not.is.null') as typeof q
  }
  if (!force) {
    const key =
      pass === 'pass1'
        ? 'metadata->>audit_pass1_at'
        : pass === 'pass2'
          ? 'metadata->>audit_pass2_at'
          : pass === 'completo'
            ? 'metadata->>audit_completo_at'
            : 'metadata->>audit_cleanup_at'
    q = q.is(key, null) as typeof q
  }
  if (sedeId) {
    q = q.eq('sede_id', sedeId) as typeof q
  }

  const { count } = await q
  return count ?? 0
}

function sanitizeMetadata(meta: unknown): Record<string, unknown> {
  if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
    return { ...(meta as Record<string, unknown>) }
  }
  return {}
}

function stringOrNull(v: unknown): string | null {
  if (v == null) return null
  const s = String(v).trim()
  return s ? s : null
}

function clamp01(n: unknown): number {
  const x = typeof n === 'number' ? n : parseFloat(String(n))
  if (!Number.isFinite(x)) return 0.5
  return Math.min(1, Math.max(0, x))
}

function buildReason(forn: boolean, tipo: boolean, date: boolean): string {
  const parts: string[] = []
  if (forn) parts.push('fornitore')
  if (tipo) parts.push('tipo')
  if (date) parts.push('data')
  return parts.length ? parts.join('+') : 'no-change'
}

const AI_TIPO_TO_PENDING_KIND: Record<string, string> = {
  fattura: 'fattura',
  invoice: 'fattura',
  tax_invoice: 'fattura',
  sales_invoice: 'fattura',
  nota_credito: 'nota_credito',
  credit_note: 'nota_credito',
  bolla: 'bolla',
  ddt: 'bolla',
  delivery_note: 'bolla',
  estratto_conto: 'statement',
  statement: 'statement',
  ordine: 'ordine',
  order: 'ordine',
  purchase_order: 'ordine',
  order_confirmation: 'ordine',
  listino: 'listino',
  price_list: 'listino',
  comunicazione: 'comunicazione',
  altro: 'comunicazione',
  other: 'comunicazione',
}

function mapAiTipoToPendingKind(rawTipo: string | null | undefined): string | null {
  if (!rawTipo) return null
  const norm = String(rawTipo).toLowerCase().replace(/\s+/g, '_').trim()
  return AI_TIPO_TO_PENDING_KIND[norm] ?? null
}

/** Esposto per test/diagnostica. */
export function _internalNormalizeOcrTipo(raw: string | null | undefined): NormalizedTipoDocumento {
  return normalizeTipoDocumento(raw ?? null)
}
