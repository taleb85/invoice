import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeTipoDocumento } from '@/lib/ocr-invoice'

export type LearnedPendingKind = 'statement' | 'bolla' | 'fattura' | 'ordine'

const HINT_TABLE = 'fornitore_ocr_tipo_pending_kind_hints' as const

/** Chiave stabile per DB: stessi bucket dell’OCR + `unknown` se il tipo non è classificato. */
export function ocrTipoHintKey(tipoDocumento: unknown): string {
  const n = normalizeTipoDocumento(tipoDocumento)
  return n ?? 'unknown'
}

function tipoFromDocMetadata(metadata: unknown): unknown {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  return (metadata as Record<string, unknown>).tipo_documento ?? null
}

/**
 * Dopo un salvataggio manuale, memorizza: per questo fornitore, documenti OCR di questo tipo
 * vanno trattati come la categoria scelta (estratto / bolla / fattura / ordine).
 */
export async function recordFornitorePendingKindHint(
  supabase: SupabaseClient,
  opts: { fornitoreId: string; ocrTipoKey: string; pendingKind: LearnedPendingKind },
): Promise<void> {
  const ocr_tipo_key = opts.ocrTipoKey.trim() || 'unknown'
  const { error } = await supabase.from(HINT_TABLE).upsert(
    {
      fornitore_id: opts.fornitoreId,
      ocr_tipo_key,
      pending_kind: opts.pendingKind,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'fornitore_id,ocr_tipo_key' },
  )
  if (error) {
    const msg = (error.message ?? '').toLowerCase()
    if (
      error.code === '42P01' ||
      msg.includes('could not find') ||
      msg.includes('does not exist') ||
      msg.includes('schema cache')
    ) {
      return
    }
    console.warn('[fornitore-doc-type-hints] upsert hint:', error.message)
  }
}

export async function fetchFornitorePendingKindHint(
  supabase: SupabaseClient,
  fornitoreId: string,
  ocrTipoKey: string,
): Promise<LearnedPendingKind | null> {
  const { data, error } = await supabase
    .from(HINT_TABLE)
    .select('pending_kind')
    .eq('fornitore_id', fornitoreId)
    .eq('ocr_tipo_key', ocrTipoKey)
    .maybeSingle()

  if (error) {
    const msg = (error.message ?? '').toLowerCase()
    if (
      error.code === '42P01' ||
      msg.includes('could not find') ||
      msg.includes('does not exist') ||
      msg.includes('schema cache')
    ) {
      return null
    }
    console.warn('[fornitore-doc-type-hints] fetch hint:', error.message)
    return null
  }

  const k = data?.pending_kind
  if (k === 'statement' || k === 'bolla' || k === 'fattura' || k === 'ordine') return k
  return null
}

/** Estrae tipo_documento dal metadata documento e ricorda la categoria scelta dall’utente. */
export async function recordLearnedKindFromDocMetadata(
  supabase: SupabaseClient,
  opts: { fornitoreId: string | null; metadata: unknown; pendingKind: LearnedPendingKind },
): Promise<void> {
  if (!opts.fornitoreId) return
  const key = ocrTipoHintKey(tipoFromDocMetadata(opts.metadata))
  await recordFornitorePendingKindHint(supabase, {
    fornitoreId: opts.fornitoreId,
    ocrTipoKey: key,
    pendingKind: opts.pendingKind,
  })
}
