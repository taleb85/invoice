import type { SupabaseClient } from '@supabase/supabase-js'
import { runQualityChain } from '@/lib/document-quality-chain'
import { logger } from '@/lib/logger'
import { fornitoreNomeMatchesOcr, tokenOverlapRatio } from '@/lib/fornitore-cross-check'
import { isSharedBillingPlatformSenderEmail } from '@/lib/fornitore-resolve-scan-email'
import { tryBootstrapFornitoreFromOcrRagione } from '@/lib/scan-email-ocr-bootstrap-fornitore'
import { cleanupSharedPlatformFornitoreEmails } from '@/lib/cleanup-shared-platform-fornitore-emails'

const BATCH = 100

type DocRow = {
  id: string
  fornitore_id: string | null
  sede_id: string | null
  mittente: string | null
  oggetto_mail: string | null
  file_name: string | null
  note: string | null
  data_documento: string | null
  created_at: string | null
  metadata: Record<string, unknown> | null
  stato: string
}

export type AutoReinferResult = {
  processed: number
  matched: number
  unchanged: number
  errors: number
  dateFixed: number
  typeFixed: number
  fornitoreReassigned: number
  fornitoreCreated: number
  ghostEmailsRemoved: number
}

async function fornitoreAssignmentContradictsOcr(
  supabase: SupabaseClient,
  fornitoreId: string,
  ocrRagioneSociale: string,
  mittente?: string | null,
): Promise<boolean> {
  const { data: f } = await supabase.from('fornitori').select('nome').eq('id', fornitoreId).maybeSingle()
  if (!f?.nome?.trim()) return false
  if (fornitoreNomeMatchesOcr(f.nome, ocrRagioneSociale)) return false
  if (isSharedBillingPlatformSenderEmail(mittente ?? '')) return true
  return tokenOverlapRatio(f.nome, ocrRagioneSociale) < 0.2
}

/**
 * Rielabora automaticamente tutti i documenti esistenti applicando la catena di qualità:
 * fornitore (2/3 segnali), data (auto-validazione), tipo documento (2/3 + apprendimento).
 *
 * Viene chiamata dopo ogni sync email e dal cron giornaliero.
 * Nessuna chiamata Gemini — solo confronto incrociato dei dati già presenti.
 */
export async function autoReinferSuppliers(
  supabase: SupabaseClient,
  opts?: {
    sedeId?: string | null
    limit?: number
    recheckExisting?: boolean
  },
): Promise<AutoReinferResult> {
  const sedeFilter = opts?.sedeId?.trim() || null
  const limit = opts?.limit && opts.limit > 0 ? Math.min(opts.limit, BATCH) : BATCH
  const recheckExisting = opts?.recheckExisting === true

  const result: AutoReinferResult = {
    processed: 0,
    matched: 0,
    unchanged: 0,
    errors: 0,
    dateFixed: 0,
    typeFixed: 0,
    fornitoreReassigned: 0,
    fornitoreCreated: 0,
    ghostEmailsRemoved: 0,
  }

  try {
    const cleanup = await cleanupSharedPlatformFornitoreEmails(supabase, { sedeId: sedeFilter })
    result.ghostEmailsRemoved = cleanup.aliasesRemoved + cleanup.primaryEmailsCleared
  } catch (e) {
    logger.warn('[AUTO-REINFER] cleanup ghost emails', e)
  }

  const stati = ['da_associare', 'da_revisionare', 'in_attesa', 'associato']

  let query = supabase
    .from('documenti_da_processare')
    .select('id, fornitore_id, sede_id, mittente, oggetto_mail, file_name, note, data_documento, created_at, metadata, stato')
    .in('stato', stati)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (sedeFilter) query = query.eq('sede_id', sedeFilter)

  const { data: docs, error: docsErr } = await query
  if (docsErr) {
    logger.error('[AUTO-REINFER] Errore query:', docsErr.message)
    return result
  }

  const pending = (docs ?? []) as DocRow[]
  if (!pending.length) return result

  for (const doc of pending) {
    const meta = doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
      ? doc.metadata as Record<string, unknown>
      : {}

    const ragioneSociale = typeof meta.ragione_sociale === 'string' ? meta.ragione_sociale.trim() : null
    const pIva = typeof meta.p_iva === 'string' ? meta.p_iva.trim() : null
    const ocrTipo = typeof meta.tipo_documento === 'string' ? meta.tipo_documento.trim() : null
    const ocrDate = typeof meta.data_fattura === 'string' ? meta.data_fattura.trim() : null

    const hasOcrData = !!(ragioneSociale || pIva || ocrTipo || ocrDate)

    if (!hasOcrData) {
      result.unchanged++
      continue
    }

    let mightContradict = false
    if (doc.fornitore_id && ragioneSociale) {
      mightContradict = await fornitoreAssignmentContradictsOcr(
        supabase,
        doc.fornitore_id,
        ragioneSociale,
        doc.mittente,
      )
    }

    if (!recheckExisting && doc.fornitore_id && doc.data_documento && meta.pending_kind && !mightContradict) {
      result.unchanged++
      continue
    }

    result.processed++

    try {
      let needsUpdate = false
      const patch: Record<string, unknown> = {}
      const updatedMeta = { ...meta }

      let effectiveFornitoreId = doc.fornitore_id

      // ── Correzione abbinamento errato (es. Xero → fornitore sbagliato) ───
      if (mightContradict && doc.fornitore_id && ragioneSociale) {
        const bootstrap = await tryBootstrapFornitoreFromOcrRagione(
          supabase,
          { ragione_sociale: ragioneSociale, p_iva: pIva },
          doc.sede_id,
          doc.mittente,
        )
        if (bootstrap.kind === 'resolved' && bootstrap.fornitore.id !== doc.fornitore_id) {
          effectiveFornitoreId = bootstrap.fornitore.id
          patch.fornitore_id = bootstrap.fornitore.id
          updatedMeta.matched_by = bootstrap.created ? 'ocr_auto_create' : 'ocr_name_reassign'
          needsUpdate = true
          if (bootstrap.created) result.fornitoreCreated++
          else result.fornitoreReassigned++
        }
      }

      // ── Catena qualità fornitore / data / tipo ───────────────────────────
      if (!effectiveFornitoreId || recheckExisting) {
        const quality = await runQualityChain(supabase, {
          mittente: doc.mittente,
          sedeId: doc.sede_id,
          ocrRagioneSociale: ragioneSociale,
          ocrPiva: pIva,
          ocrDate,
          ocrTipo,
          receivedAt: doc.created_at,
          fileName: doc.file_name,
          emailSubject: doc.oggetto_mail,
          fornitoreId: needsUpdate ? effectiveFornitoreId : doc.fornitore_id,
        })

        if (quality.fornitoreId && quality.fornitoreId !== effectiveFornitoreId) {
          patch.fornitore_id = quality.fornitoreId
          effectiveFornitoreId = quality.fornitoreId
          updatedMeta.matched_by = quality.fornitoreSource
          needsUpdate = true
        }

        if (quality.documentDate && quality.documentDate !== (doc.data_documento?.trim() || null)) {
          patch.data_documento = quality.documentDate
          needsUpdate = true
          result.dateFixed++
        }

        const currentKind = typeof meta.pending_kind === 'string' ? meta.pending_kind : null
        if (quality.documentType && quality.documentType !== currentKind) {
          updatedMeta.pending_kind = quality.documentType
          if (quality.documentType === 'statement') patch.is_statement = true
          needsUpdate = true
          result.typeFixed++
        }
      }

      if (needsUpdate) {
        patch.metadata = updatedMeta
        await supabase
          .from('documenti_da_processare')
          .update(patch)
          .eq('id', doc.id)
        result.matched++
      } else {
        result.unchanged++
      }
    } catch {
      result.errors++
    }
  }

  return result
}
