import type { SupabaseClient } from '@supabase/supabase-js'
import { runQualityChain } from '@/lib/document-quality-chain'
import { classifyDocumentWithGemini } from '@/lib/gemini-inbox-classify'
import { resolveFornitoreByPartialNameEnhanced } from '@/lib/fornitore-infer-from-document'
import { normalizeTipoDocumento, type NormalizedTipoDocumento } from '@/lib/ocr-tipo-documento'
import { logger } from '@/lib/logger'

/**
 * Audit & fix unico: in una sola passata controlla TUTTI i documenti
 * (qualunque stato) e prova a correggere automaticamente fornitore + tipologia
 * usando solo i segnali già acquisiti, e — se richiesto — Gemini Vision.
 *
 * Chiamato in loop dall'endpoint `/api/admin/audit-and-fix-all`. Ogni invocazione
 * processa un piccolo batch e ritorna `has_more` finché restano documenti idonei.
 *
 * Idempotente: marca `metadata.audit_pass1_at` (passata deterministica) e
 * `metadata.audit_pass2_at` (passata AI) sui documenti già revisionati così
 * non vengono ritoccati ai cicli successivi.
 */

// ── Soglie ────────────────────────────────────────────────────────────────────

/** Confidenza minima della passata AI per applicare automaticamente un nuovo tipo. */
export const AUDIT_AI_AUTO_APPLY_MIN_CONFIDENCE = 0.85

/** Pattern testuali (subject/filename) che identificano una conferma d'ordine. */
const ORDER_CONFIRMATION_PATTERN =
  /\border\s+confirmation\b|\border\s+acknowledg|\border\s+confirmed\b|\bsales\s+order\s+confirm|\bpurchase\s+order\b.{0,40}\bconfirm|conferma\s+(d['’])?ordine|ordine\s+confermato/i

// ── Tipi ──────────────────────────────────────────────────────────────────────

export type AuditPhase = 'deterministic' | 'ai' | 'cleanup_misclassified'

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
  /** Cosa stava per essere cancellato: bolla_id, fattura_id, fattura_id_orfana_collegata. */
  deleted_bolla_id: string | null
  deleted_fattura_id: string | null
  /** Fatture orfane che puntavano alla bolla cancellata. */
  deleted_orphan_fattura_ids: string[]
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
    .order('created_at', { ascending: false })

  if (!opts.force) {
    q = q.is('metadata->>audit_pass1_at', null) as typeof q
  }
  if (opts.sedeId) {
    q = q.eq('sede_id', opts.sedeId) as typeof q
  }

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
  if (!docs.length) return result

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

  result.has_more = remaining > docs.length
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
  if (!hasOcr) {
    // Nulla da ricalcolare in pass 1: solo marca per non riprovare al prossimo giro
    await stampPass1(service, doc.id, meta, { skipped_reason: 'no_ocr_metadata' })
    return null
  }

  // Ricalcolo SENZA dare fornitoreId: forza la quality-chain a rivalutare i 3 segnali
  // anche per documenti che hanno già un fornitore (potrebbe essere quello sbagliato).
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
    fornitoreId: null,
  })

  const updates: Record<string, unknown> = {}
  const updatedMeta: Record<string, unknown> = { ...meta }

  let fornitoreChanged = false
  let tipoChanged = false

  if (
    quality.fornitoreConfidence >= 2 &&
    quality.fornitoreId &&
    quality.fornitoreId !== doc.fornitore_id
  ) {
    updates.fornitore_id = quality.fornitoreId
    updatedMeta.matched_by = quality.fornitoreSource
    fornitoreChanged = true
  }

  if (
    quality.documentDate &&
    quality.documentDate !== (doc.data_documento?.trim() || null)
  ) {
    updates.data_documento = quality.documentDate
  }

  const currentKind = stringOrNull(meta.pending_kind)
  if (
    quality.typeConfidence >= 2 &&
    quality.documentType &&
    quality.documentType !== currentKind
  ) {
    updatedMeta.pending_kind = quality.documentType
    if (quality.documentType === 'statement') updates.is_statement = true
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

  // Propaga a fatture/bolle se il fornitore è cambiato.
  // Rispetta la sede di destinazione: l'API `audit-fornitore-match/reassign`
  // fa lo stesso join, qui replichiamo la logica ma su un range di documenti.
  if (fornitoreChanged && quality.fornitoreId) {
    if (doc.fattura_id) {
      const { error: e1 } = await service
        .from('fatture')
        .update({ fornitore_id: quality.fornitoreId })
        .eq('id', doc.fattura_id)
      if (e1) logger.error('[audit-and-fix:pass1] fattura update err', doc.fattura_id, e1.message)
    }
    if (doc.bolla_id) {
      const { error: e2 } = await service
        .from('bolle')
        .update({ fornitore_id: quality.fornitoreId })
        .eq('id', doc.bolla_id)
      if (e2) logger.error('[audit-and-fix:pass1] bolla update err', doc.bolla_id, e2.message)
    }
  }

  return {
    doc_id: doc.id,
    fornitore_id_before: doc.fornitore_id,
    fornitore_id_after: fornitoreChanged ? quality.fornitoreId : doc.fornitore_id,
    tipo_before: currentKind,
    tipo_after: tipoChanged ? quality.documentType : currentKind,
    fattura_id: doc.fattura_id,
    bolla_id: doc.bolla_id,
    reason: buildReason(fornitoreChanged, tipoChanged, 'data_documento' in updates),
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
    .order('created_at', { ascending: false })

  if (!opts.force) {
    q = q.is('metadata->>audit_pass2_at', null) as typeof q
  }
  if (opts.sedeId) {
    q = q.eq('sede_id', opts.sedeId) as typeof q
  }

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

  result.has_more = remaining > docs.length
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
    if (doc.fattura_id) {
      await service.from('fatture').update({ fornitore_id: suggestedFornitoreId }).eq('id', doc.fattura_id)
    }
    if (doc.bolla_id) {
      await service.from('bolle').update({ fornitore_id: suggestedFornitoreId }).eq('id', doc.bolla_id)
    }
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

// ── Pass 3: cleanup misclassified (cancella bolle/fatture create da Order Confirmation) ─

type Pass3Opts = {
  sedeId?: string | null
  /** Quanti documenti per ciclo. Default 25 (cancellazioni sono pesanti). */
  batchSize?: number
  /** Se true: solo report, nessuna cancellazione. Default false. */
  dryRun?: boolean
  /** Riprocessa anche già marcati `audit_cleanup_at`. */
  force?: boolean
}

/**
 * Pulisce le bolle/fatture create per errore quando il documento sorgente è
 * una conferma d'ordine ("Order Confirmation"). Si applica solo se:
 *
 *   - `metadata.pending_kind === 'ordine'` (segnale principale, già consolidato
 *     da pass 1 / pass 2 / cron di reclassify)
 *   - subject email o nome file contiene un pattern "order confirmation"
 *     (segnale secondario di conferma, evita falsi positivi)
 *   - esiste una `bolla_id` o `fattura_id` collegata
 *
 * Cosa cancella:
 *   1. La riga `bolle` o `fatture` collegata
 *   2. Eventuali fatture-orfane create dallo stesso Order Confirmation che
 *      puntano alla stessa bolla (`fatture.bolla_id = bolla.id`)
 *   3. La riga `documenti_da_processare` (opzionale: la mantiene se preferisci)
 *
 * Idempotente: marca `metadata.audit_cleanup_at` su righe non più cancellabili.
 *
 * Modalità `dryRun`: ritorna l'elenco delle azioni che farebbe senza eseguire
 * nessuna cancellazione.
 */
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

  // Query: pending_kind=ordine + (bolla_id OR fattura_id) + pattern order confirmation
  let q = service
    .from('documenti_da_processare')
    .select(`${DOC_SELECT}, fornitori(nome)`)
    .filter('metadata->>pending_kind', 'eq', 'ordine')
    .or('bolla_id.not.is.null,fattura_id.not.is.null')
    .or('oggetto_mail.ilike.*order*confirmation*,file_name.ilike.*order*confirmation*')
    .order('created_at', { ascending: false })

  // Idempotenza: salta documenti già processati (anche se dry-run, ai re-run
  // applicativi non li ripuliamo a vuoto).
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
  if (!docs.length) return result

  for (const doc of docs) {
    result.checked++
    try {
      const action = await applyCleanup(service, doc, dryRun)
      if (action) {
        result.cleanup_actions!.push(action)
      } else {
        result.unchanged++
      }
    } catch (e) {
      result.errors++
      logger.error('[audit-and-fix:cleanup] doc', doc.id, e)
    }
  }

  result.has_more = remaining > docs.length
  return result
}

async function applyCleanup(
  service: SupabaseClient,
  doc: DocRow & { fornitori?: { nome?: string } | null },
  dryRun: boolean,
): Promise<AuditCleanupAction | null> {
  const meta = sanitizeMetadata(doc.metadata)

  // Doppio check: il pattern testuale deve confermare la classificazione.
  const blob = `${doc.oggetto_mail ?? ''}\n${doc.file_name ?? ''}`
  if (!ORDER_CONFIRMATION_PATTERN.test(blob)) {
    // Segna come visto ma non cancellare: i filtri SQL hanno fatto match
    // larghi (ilike *order*confirmation*) ma il regex più stretto non conferma.
    if (!dryRun) {
      await stampCleanup(service, doc.id, meta, { skipped_reason: 'pattern_not_confirmed' })
    }
    return null
  }

  // Sicurezza extra: `pending_kind` deve essere 'ordine'
  if (meta.pending_kind !== 'ordine') {
    if (!dryRun) {
      await stampCleanup(service, doc.id, meta, { skipped_reason: 'pending_kind_changed' })
    }
    return null
  }

  // Sicurezza extra: NON toccare se ha lo stato è una bozza o se è linkato in
  // fattura_bolle (caso composito che richiede review umana).
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
      return null
    }
  }

  const action: AuditCleanupAction = {
    doc_id: doc.id,
    fornitore_nome: doc.fornitori?.nome ?? null,
    oggetto_mail: doc.oggetto_mail,
    file_name: doc.file_name,
    pending_kind: 'ordine',
    deleted_bolla_id: null,
    deleted_fattura_id: null,
    deleted_orphan_fattura_ids: [],
    applied: false,
  }

  // ── Step 1: Trova fatture orfane che puntano alla bolla ───────────────────
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

  // ── Step 2: Esegui cancellazioni (o solo report se dry-run) ───────────────
  if (dryRun) {
    action.deleted_bolla_id = doc.bolla_id
    action.deleted_fattura_id = doc.fattura_id
    action.deleted_orphan_fattura_ids = orphanFatturaIds
    action.applied = false
    return action
  }

  // 2a. Cancella fatture orfane che puntano alla bolla
  if (orphanFatturaIds.length > 0) {
    const { error: errOrphan } = await service
      .from('fatture')
      .delete()
      .in('id', orphanFatturaIds)
    if (errOrphan) throw new Error(`fatture orfane: ${errOrphan.message}`)
    action.deleted_orphan_fattura_ids = orphanFatturaIds
  }

  // 2b. Cancella la bolla collegata
  if (doc.bolla_id) {
    const { error: errBolla } = await service.from('bolle').delete().eq('id', doc.bolla_id)
    if (errBolla) throw new Error(`bolla: ${errBolla.message}`)
    action.deleted_bolla_id = doc.bolla_id
  }

  // 2c. Cancella la fattura collegata (se diversa da quelle orfane già rimosse)
  if (doc.fattura_id && !orphanFatturaIds.includes(doc.fattura_id)) {
    const { error: errFat } = await service.from('fatture').delete().eq('id', doc.fattura_id)
    if (errFat) throw new Error(`fattura: ${errFat.message}`)
    action.deleted_fattura_id = doc.fattura_id
  }

  // 2d. Marca documenti_da_processare come scartato + audit_cleanup_at
  // (NON cancelliamo la riga: l'utente ha chiesto di mantenere il file
  // accessibile. Lo stato 'scartato' lo rimuove dalle viste attive.)
  const newMeta: Record<string, unknown> = {
    ...meta,
    audit_cleanup_at: new Date().toISOString(),
    audit_cleanup_action: 'order_confirmation_purged',
    audit_cleanup_deleted: {
      bolla_id: action.deleted_bolla_id,
      fattura_id: action.deleted_fattura_id,
      orphan_fattura_ids: action.deleted_orphan_fattura_ids,
    },
  }
  const { error: errDoc } = await service
    .from('documenti_da_processare')
    .update({
      stato: 'scartato',
      bolla_id: null,
      fattura_id: null,
      metadata: newMeta,
      note:
        (doc.note ? doc.note + ' · ' : '') +
        `Conferma ordine erroneamente importata, pulita il ${new Date().toISOString().slice(0, 10)}`,
    })
    .eq('id', doc.id)
  if (errDoc) throw new Error(`documento: ${errDoc.message}`)

  action.applied = true
  return action
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

// ── Helpers ───────────────────────────────────────────────────────────────────

async function countRemaining(
  service: SupabaseClient,
  sedeId: string | null,
  pass: 'pass1' | 'pass2' | 'cleanup',
  force: boolean,
): Promise<number> {
  let q = service
    .from('documenti_da_processare')
    .select('id', { count: 'exact', head: true })

  if (pass === 'pass2') {
    q = q.not('file_url', 'is', null).not('file_url', 'eq', '') as typeof q
  }
  if (pass === 'cleanup') {
    q = q
      .filter('metadata->>pending_kind', 'eq', 'ordine')
      .or('bolla_id.not.is.null,fattura_id.not.is.null')
      .or('oggetto_mail.ilike.*order*confirmation*,file_name.ilike.*order*confirmation*') as typeof q
  }
  if (!force) {
    const key =
      pass === 'pass1'
        ? 'metadata->>audit_pass1_at'
        : pass === 'pass2'
          ? 'metadata->>audit_pass2_at'
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
