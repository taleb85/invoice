import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'
import { requireAdmin } from '@/lib/api-auth'
import { classifyDocumentWithGemini, type GeminiInboxClassification } from '@/lib/gemini-inbox-classify'
import { scanContextSuggestsFattura, scanContextSuggestsBolla, scanContextSuggestsListino } from '@/lib/document-bozza-routing'
import { logActivity, ACTIVITY_ACTIONS } from '@/lib/activity-logger'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const BATCH = 5

const AI_KINDS_MAP: Record<string, 'fattura' | 'bolla' | 'nota_credito' | 'comunicazione' | 'listino'> = {
  fattura: 'fattura',
  invoice: 'fattura',
  tax_invoice: 'fattura',
  sales_invoice: 'fattura',
  bolla: 'bolla',
  ddt: 'bolla',
  delivery_note: 'bolla',
  nota_credito: 'nota_credito',
  credit_note: 'nota_credito',
  listino: 'listino',
  price_list: 'listino',
  ordine: 'comunicazione',
  order: 'comunicazione',
  purchase_order: 'comunicazione',
  comunicazione: 'comunicazione',
  altro: 'comunicazione',
  other: 'comunicazione',
  statement: 'comunicazione',
  estratto_conto: 'comunicazione',
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { profile } = auth
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json({ error: 'GEMINI_API_KEY non configurata' }, { status: 503 })
  }

  const service = createServiceClient()

  let body: { sede_id?: string; pending_kind?: string; limit?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const limit = Math.min(body.limit ?? BATCH, BATCH)

  let q = service
    .from('documenti_da_processare')
    .select('id, file_url, file_name, content_type, stato, oggetto_mail, metadata')
    .not('file_url', 'is', null)
    .not('file_url', 'eq', '')
    // Esclude documenti già processati da AI (hanno ai_classified_at nel metadata)
    .is('metadata->>ai_classified_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (body.sede_id) {
    q = q.eq('sede_id', body.sede_id)
  }

  if (body.pending_kind) {
    q = q.filter('metadata->>pending_kind', 'eq', body.pending_kind)
  }

  const { data: docs, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!docs?.length) {
    return NextResponse.json({ ok: true, checked: 0, updated: 0, errors: 0, has_more: false, message: 'Nessun documento da processare o tutti già analizzati da AI' })
  }

  type DocRow = { id: string; file_url: string | null; file_name: string | null; content_type: string | null; stato: string | null; oggetto_mail: string | null; metadata: Record<string, unknown> | null }

  let updated = 0
  let errors = 0
  const results: { id: string; tipo_ai: string; old_kind: string | null; new_kind: string | null; error?: string }[] = []

  for (const doc of docs as DocRow[]) {
    try {
      const suggestion: GeminiInboxClassification = await classifyDocumentWithGemini(service, {
        id: doc.id,
        file_url: doc.file_url,
        file_name: doc.file_name,
        content_type: doc.content_type,
      })

      if (suggestion.error) {
        results.push({ id: doc.id, tipo_ai: suggestion.tipo_suggerito ?? 'errore', old_kind: null, new_kind: null, error: suggestion.error })
        errors++
        continue
      }

      const tipoAi = (suggestion.tipo_suggerito ?? '').toLowerCase().replace(/\s+/g, '_').trim()

      // Map AI classification to pending_kind
      let newKind: string | null = AI_KINDS_MAP[tipoAi] ?? 'comunicazione'

      // If AI says "altro"/generic, check subject/file name heuristic as fallback
      if (newKind === 'comunicazione') {
        const subj = doc.oggetto_mail
        const fname = doc.file_name
        const subjOrName = ((subj ?? '') + '\n' + (fname ?? '')).toLowerCase().replace(/[_.\-]/g, ' ')
        const looksLikeInvoice = /\binvoice\b/.test(subjOrName) || /\bfattura\b/.test(subjOrName) || /\bsales\s?invoice\b/.test(subjOrName) || /\btax\s?invoice\b/.test(subjOrName) || /\bcredit\s?note\b/.test(subjOrName) || /nota\s+credito/.test(subjOrName) || /\bddt\b/.test(subjOrName) || /\bbolla\b/.test(subjOrName) || /delivery\s?note/.test(subjOrName)
        if (looksLikeInvoice) {
          const ctxFat = scanContextSuggestsFattura(subj, fname)
          const ctxBol = scanContextSuggestsBolla(subj, fname)
          if (ctxFat && !ctxBol) newKind = 'fattura'
          else if (ctxBol && !ctxFat) newKind = 'bolla'
        }
        if (newKind === 'comunicazione' && scanContextSuggestsListino(subj, fname)) {
          newKind = 'listino'
        }
      }

      const currentKind = (doc.metadata?.pending_kind as string) ?? null

      // Aggiorna SEMPRE metadata per segnare che è stato processato da AI,
      // anche se pending_kind non cambia
      const prevMeta = { ...(doc.metadata ?? {}) }
      prevMeta.ai_classified_at = new Date().toISOString()
      prevMeta.ai_tipo_suggerito = tipoAi
      prevMeta.ai_confidenza = suggestion.confidenza

      if (newKind && newKind !== currentKind) {
        prevMeta.pending_kind = newKind
        prevMeta.ai_classified_from = currentKind
      }

      const { error: uErr } = await service
        .from('documenti_da_processare')
        .update({ metadata: prevMeta })
        .eq('id', doc.id)

      if (uErr) {
        results.push({ id: doc.id, tipo_ai: tipoAi, old_kind: currentKind, new_kind: null, error: uErr.message })
        errors++
        continue
      }

      if (newKind && newKind !== currentKind) updated++
      results.push({ id: doc.id, tipo_ai: tipoAi, old_kind: currentKind, new_kind: newKind && newKind !== currentKind ? newKind : currentKind })
    } catch (e) {
      results.push({ id: doc.id, tipo_ai: 'errore', old_kind: null, new_kind: null, error: e instanceof Error ? e.message : String(e) })
      errors++
    }
  }

  await logActivity(service, {
    userId: profile.id,
    sedeId: body.sede_id ?? null,
    action: ACTIVITY_ACTIONS.DOCUMENTO_PROCESSED,
    entityType: 'documenti_da_processare',
    metadata: {
      ai_reclassified: true,
      checked: docs.length,
      updated,
      errors,
    },
  })

  return NextResponse.json({
    ok: true,
    checked: docs.length,
    updated,
    errors,
    results,
    has_more: docs.length >= limit,
  })
}
