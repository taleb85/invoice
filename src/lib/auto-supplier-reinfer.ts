import type { SupabaseClient } from '@supabase/supabase-js'
import { runQualityChain } from '@/lib/document-quality-chain'
import { logger } from '@/lib/logger'

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

  const result: AutoReinferResult = { processed: 0, matched: 0, unchanged: 0, errors: 0, dateFixed: 0, typeFixed: 0 }

  let query = supabase
    .from('documenti_da_processare')
    .select('id, fornitore_id, sede_id, mittente, oggetto_mail, file_name, note, data_documento, created_at, metadata, stato')
    .in('stato', ['da_associare', 'da_revisionare', 'in_attesa'])
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

    if (!recheckExisting && doc.fornitore_id && doc.data_documento && meta.pending_kind) {
      result.unchanged++
      continue
    }

    result.processed++

    try {
      let needsUpdate = false
      const patch: Record<string, unknown> = {}
      const updatedMeta = { ...meta }

      // ── Catena qualità fornitore ─────────────────────────────────────────
      if (!doc.fornitore_id || recheckExisting) {
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
          fornitoreId: doc.fornitore_id,
        })

        if (quality.fornitoreId && quality.fornitoreId !== doc.fornitore_id) {
          patch.fornitore_id = quality.fornitoreId
          updatedMeta.matched_by = quality.fornitoreSource
          needsUpdate = true
        }

        // ── Catena qualità data ────────────────────────────────────────────
        if (quality.documentDate && quality.documentDate !== (doc.data_documento?.trim() || null)) {
          patch.data_documento = quality.documentDate
          needsUpdate = true
          result.dateFixed++
        }

        // ── Catena qualità tipo documento ──────────────────────────────────
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
