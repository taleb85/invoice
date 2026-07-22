import type { SupabaseClient } from '@supabase/supabase-js'
import { runQualityChain } from '@/lib/document-quality-chain'
import { logger } from '@/lib/logger'
import { fornitoreNomeMatchesOcr, tokenOverlapRatio } from '@/lib/fornitore-cross-check'
import { isSharedBillingPlatformSenderEmail } from '@/lib/fornitore-resolve-scan-email'
import { tryBootstrapFornitoreFromOcrRagione } from '@/lib/scan-email-ocr-bootstrap-fornitore'
import { cleanupSharedPlatformFornitoreEmails } from '@/lib/cleanup-shared-platform-fornitore-emails'
import { fixStatementFornitoreDriftBatch } from '@/lib/audit-statement-fornitore-fix'
import {
  extractStatementFromSupplierName,
  statementEmailSubjectMatchesFornitore,
} from '@/lib/statement-supplier-subject'
import { resolveConfermaOrdineNumero } from '@/lib/extract-doc-type'
import { totaleFromDocMetadata } from '@/lib/conferme-ordine-importo'
import { normalizeNumeroFattura } from '@/lib/fattura-duplicate-check'

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
  statementDriftFixed: number
  /** Ordini finalizzati automaticamente (fornitore noto + data documento). */
  ordineAutoFinalized: number
}

async function fornitoreAssignmentContradictsOcr(
  supabase: SupabaseClient,
  fornitoreId: string,
  ocrRagioneSociale: string | null | undefined,
  opts?: { mittente?: string | null; oggetto_mail?: string | null },
): Promise<boolean> {
  const { data: f } = await supabase
    .from('fornitori')
    .select('nome, display_name')
    .eq('id', fornitoreId)
    .maybeSingle()
  if (!f?.nome?.trim()) return false

  const rs = ocrRagioneSociale?.trim()
  if (rs) {
    if (fornitoreNomeMatchesOcr(f.nome, rs)) return false
    if (isSharedBillingPlatformSenderEmail(opts?.mittente ?? '')) return true
    if (tokenOverlapRatio(f.nome, rs) < 0.2) return true
  }

  if (opts?.oggetto_mail && extractStatementFromSupplierName(opts.oggetto_mail)) {
    if (
      !statementEmailSubjectMatchesFornitore(
        opts.oggetto_mail,
        f.nome,
        f.display_name,
        rs,
      )
    ) {
      return true
    }
  }

  return false
}

function preferredSupplierNameFromDoc(
  ragioneSociale: string | null | undefined,
  oggettoMail: string | null | undefined,
): string | null {
  return extractStatementFromSupplierName(oggettoMail) ?? ragioneSociale?.trim() ?? null
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
    statementDriftFixed: 0,
    ordineAutoFinalized: 0,
  }

  try {
    const cleanup = await cleanupSharedPlatformFornitoreEmails(supabase, { sedeId: sedeFilter })
    result.ghostEmailsRemoved = cleanup.aliasesRemoved + cleanup.primaryEmailsCleared
  } catch (e) {
    logger.warn('[AUTO-REINFER] cleanup ghost emails', e)
  }

  try {
    const drift = await fixStatementFornitoreDriftBatch(supabase, {
      sedeId: sedeFilter,
      batchSize: 50,
    })
    result.statementDriftFixed = drift.fixes.length
  } catch (e) {
    logger.warn('[AUTO-REINFER] statement subject drift', e)
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
    const supplierNameHint = preferredSupplierNameFromDoc(ragioneSociale, doc.oggetto_mail)
    if (doc.fornitore_id && supplierNameHint) {
      mightContradict = await fornitoreAssignmentContradictsOcr(
        supabase,
        doc.fornitore_id,
        ragioneSociale,
        { mittente: doc.mittente, oggetto_mail: doc.oggetto_mail },
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
      if (mightContradict && doc.fornitore_id && supplierNameHint) {
        const bootstrap = await tryBootstrapFornitoreFromOcrRagione(
          supabase,
          { ragione_sociale: supplierNameHint, p_iva: pIva },
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

  // ── Auto-finalizza ordini con fornitore e data noti ──────────────────────
  if (result.ordineAutoFinalized === 0) {
    // Solo se la passata qualità non ha già messo ordini in coda più recente;
    // esegue una query dedicata per intercettare eventuali ordini già con fornitore
    result.ordineAutoFinalized = await autoFinalizeOrdineDocuments(supabase, { sedeId: sedeFilter })
  }

  return result
}

/**
 * Finalizza automaticamente i documenti con `pending_kind = 'ordine'`,
 * fornitore noto e data documento presente.
 * Crea un record in `conferme_ordine` e aggiorna lo stato a `associato`.
 */
async function autoFinalizeOrdineDocuments(
  supabase: SupabaseClient,
  opts?: { sedeId?: string | null },
): Promise<number> {
  const sedeFilter = opts?.sedeId?.trim() || null
  let count = 0

  try {
    // Query documenti ordine in attesa con fornitore e data noti
    let q = supabase
      .from('documenti_da_processare')
      .select('id, fornitore_id, sede_id, mittente, oggetto_mail, file_name, file_url, data_documento, metadata')
      .eq('stato', 'da_associare')
      .not('fornitore_id', 'is', null)
      .not('data_documento', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)

    if (sedeFilter) q = q.eq('sede_id', sedeFilter)

    const { data: docs, error: docsErr } = await q
    if (docsErr) {
      logger.error('[AUTO-REINFER][ORDINE] Errore query:', docsErr.message)
      return 0
    }
    if (!docs?.length) return 0

    // Filtra quelli con pending_kind = 'ordine'
    const ordineDocs = docs.filter((d) => {
      const meta = d.metadata && typeof d.metadata === 'object' && !Array.isArray(d.metadata)
        ? (d.metadata as Record<string, unknown>)
        : {}
      return typeof meta.pending_kind === 'string' && meta.pending_kind === 'ordine'
    })

    if (!ordineDocs.length) return 0

    for (const doc of ordineDocs) {
      try {
        const meta = doc.metadata as Record<string, unknown> | undefined
        const mitt = typeof doc.mittente === 'string' ? doc.mittente : null
        const titolo = typeof doc.oggetto_mail === 'string' ? doc.oggetto_mail : null
        const fileName = typeof doc.file_name === 'string' ? doc.file_name : null
        const numeroFatturaMeta =
          meta && typeof meta.numero_fattura === 'string' && meta.numero_fattura.trim()
            ? meta.numero_fattura.trim()
            : null

        const numeroOrdineResolved = resolveConfermaOrdineNumero({
          titolo: null,
          fileName,
          numeroFatturaMetadata: numeroFatturaMeta,
          oggettoMail: titolo,
        })
        const numeroOrdine = numeroOrdineResolved ? normalizeNumeroFattura(numeroOrdineResolved) : null
        const titoloOrdine = numeroOrdineResolved || titolo
        const dataDoc = typeof doc.data_documento === 'string' ? doc.data_documento.trim() : null

        if (!dataDoc) continue

        // ── Duplicate check by file_url ──
        const fileUrl = typeof doc.file_url === 'string' ? doc.file_url.trim() : ''
        if (fileUrl) {
          const { data: dupByUrl } = await supabase
            .from('conferme_ordine')
            .select('id')
            .eq('fornitore_id', doc.fornitore_id)
            .eq('file_url', fileUrl)
            .limit(1)
          if (dupByUrl?.[0]) {
            await supabase
              .from('documenti_da_processare')
              .update({ stato: 'associato', bolla_id: null, fattura_id: null })
              .eq('id', doc.id)
            count++
            continue
          }
        }

        // ── Duplicate check by numero_ordine + data ──
        if (numeroOrdine && dataDoc) {
          const { data: dupByNum } = await supabase
            .from('conferme_ordine')
            .select('id')
            .eq('fornitore_id', doc.fornitore_id)
            .eq('numero_ordine', numeroOrdine)
            .eq('data_ordine', dataDoc)
            .limit(1)
          if (dupByNum?.[0]) {
            await supabase
              .from('documenti_da_processare')
              .update({ stato: 'associato', bolla_id: null, fattura_id: null })
              .eq('id', doc.id)
            count++
            continue
          }
        }

        // ── Righe prodotto (Rekki) ──
        const righe = Array.isArray(meta?.rekki_lines)
          ? (meta!.rekki_lines as unknown[])
          : null

        // ── Importo ──
        const importoOrdine = meta ? totaleFromDocMetadata(meta) : null

        // ── Sede definitiva ──
        const { data: fornitoreRow } = await supabase
          .from('fornitori')
          .select('sede_id')
          .eq('id', doc.fornitore_id)
          .maybeSingle()
        const sedeDefinitiva = fornitoreRow?.sede_id ?? doc.sede_id ?? null

        // ── Insert in conferme_ordine ──
        const confermaPayload: Record<string, unknown> = {
          fornitore_id: doc.fornitore_id,
          sede_id: sedeDefinitiva,
          file_url: doc.file_url,
          file_name: fileName,
          titolo: titoloOrdine,
          numero_ordine: numeroOrdine,
          data_ordine: dataDoc,
          note: null,
        }
        if (righe) confermaPayload.righe = righe
        if (importoOrdine != null) confermaPayload.importo_totale = importoOrdine

        const { error: coErr } = await supabase.from('conferme_ordine').insert([confermaPayload])

        if (coErr && coErr.message?.includes('conferme_ordine')) {
          // Tabella non disponibile — log e skip silenzioso
          logger.warn('[AUTO-REINFER][ORDINE] Tabella conferme_ordine non disponibile:', coErr.message)
          continue
        }
        if (coErr) {
          logger.warn('[AUTO-REINFER][ORDINE] Errore insert conferma ordine:', coErr.message)
          continue
        }

        // ── Update documento → associato ──
        await supabase
          .from('documenti_da_processare')
          .update({
            stato: 'associato',
            bolla_id: null,
            fattura_id: null,
            ...(sedeDefinitiva && !doc.sede_id ? { sede_id: sedeDefinitiva } : {}),
          })
          .eq('id', doc.id)

        count++
        logger.info(
          `[AUTO-REINFER][ORDINE] ✅ Finalizzato ordine ${numeroOrdine || titoloOrdine || doc.id} per fornitore ${doc.fornitore_id}`,
        )
      } catch (e) {
        logger.warn('[AUTO-REINFER][ORDINE] Errore finalizzazione:', e)
      }
    }
  } catch (e) {
    logger.error('[AUTO-REINFER][ORDINE] Errore generale:', e)
  }

  return count
}
