import type { SupabaseClient } from '@supabase/supabase-js'
import { ACTIVITY_ACTIONS, logActivity } from '@/lib/activity-logger'

export type MergeFornitoriResult = {
  targetId: string
  sourceId: string
  moved: Record<string, number>
  deletedSource: boolean
}

type FornitoreRow = {
  id: string
  nome: string
  sede_id: string
  email: string | null
  piva: string | null
  display_name: string | null
  indirizzo: string | null
  rekki_link: string | null
  rekki_supplier_id: string | null
  logo_url: string | null
  language: string | null
}

const SIMPLE_MOVE_TABLES = [
  'fatture',
  'bolle',
  'statements',
  'statement_rows',
  'documenti_da_processare',
  'price_anomalies',
  'conferme_ordine',
  'log_sincronizzazione',
  'fornitore_contatti',
  'rekki_price_history',
  'rekki_auto_orders',
] as const

async function dedupeMittenteAssocBeforeMove(
  service: SupabaseClient,
  sourceId: string,
  targetId: string,
): Promise<number> {
  const { data: targetRows } = await service
    .from('mittente_fornitore_assoc_stats')
    .select('mittente_email')
    .eq('fornitore_id', targetId)
  const emails = new Set(
    (targetRows ?? []).map((r) => String((r as { mittente_email: string }).mittente_email).toLowerCase()),
  )
  if (emails.size === 0) return 0
  const { data: sourceRows } = await service
    .from('mittente_fornitore_assoc_stats')
    .select('id, mittente_email')
    .eq('fornitore_id', sourceId)
  const dropIds = (sourceRows ?? [])
    .filter((r) => emails.has(String((r as { mittente_email: string }).mittente_email).toLowerCase()))
    .map((r) => (r as { id: string }).id)
  if (dropIds.length === 0) return 0
  const { error } = await service.from('mittente_fornitore_assoc_stats').delete().in('id', dropIds)
  if (error) throw new Error(`mittente_fornitore_assoc_stats (dedup): ${error.message}`)
  return dropIds.length
}

async function countRows(
  service: SupabaseClient,
  table: string,
  fornitoreId: string,
): Promise<number> {
  const { count, error } = await service
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('fornitore_id', fornitoreId)
  if (error) throw new Error(`${table}: ${error.message}`)
  return count ?? 0
}

async function moveRows(
  service: SupabaseClient,
  table: string,
  sourceId: string,
  targetId: string,
): Promise<number> {
  const before = await countRows(service, table, sourceId)
  if (before === 0) return 0
  const { error } = await service.from(table).update({ fornitore_id: targetId }).eq('fornitore_id', sourceId)
  if (error) throw new Error(`${table}: ${error.message}`)
  return before
}

/** Unisce `sourceId` in `targetId` (stessa sede), poi elimina il fornitore sorgente. */
export async function mergeFornitori(
  service: SupabaseClient,
  opts: { targetId: string; sourceId: string; userId: string },
): Promise<MergeFornitoriResult> {
  const { targetId, sourceId, userId } = opts
  if (targetId === sourceId) {
    throw new Error('Seleziona un fornitore diverso da questo profilo')
  }

  const { data: rows, error: loadErr } = await service
    .from('fornitori')
    .select(
      'id, nome, sede_id, email, piva, display_name, indirizzo, rekki_link, rekki_supplier_id, logo_url, language',
    )
    .in('id', [targetId, sourceId])

  if (loadErr) throw new Error(loadErr.message)
  const target = rows?.find((r) => r.id === targetId) as FornitoreRow | undefined
  const source = rows?.find((r) => r.id === sourceId) as FornitoreRow | undefined
  if (!target || !source) throw new Error('Fornitore non trovato')
  if (target.sede_id !== source.sede_id) {
    throw new Error('I due fornitori devono appartenere alla stessa sede')
  }

  const moved: Record<string, number> = {}

  // Listino: evita duplicati prodotto sul target
  const { data: targetListino } = await service
    .from('listino_prezzi')
    .select('prodotto')
    .eq('fornitore_id', targetId)
  const targetProducts = new Set(
    (targetListino ?? []).map((r) => String((r as { prodotto: string }).prodotto).trim()),
  )
  if (targetProducts.size > 0) {
    const { data: sourceListino } = await service
      .from('listino_prezzi')
      .select('id, prodotto')
      .eq('fornitore_id', sourceId)
    const toDelete = (sourceListino ?? [])
      .filter((r) => targetProducts.has(String((r as { prodotto: string }).prodotto).trim()))
      .map((r) => (r as { id: string }).id)
    if (toDelete.length > 0) {
      const { error: delListinoErr } = await service.from('listino_prezzi').delete().in('id', toDelete)
      if (delListinoErr) throw new Error(`listino_prezzi (dedup): ${delListinoErr.message}`)
      moved.listino_prezzi_deduped = toDelete.length
    }
  }
  moved.listino_prezzi = await moveRows(service, 'listino_prezzi', sourceId, targetId)

  const mittenteDeduped = await dedupeMittenteAssocBeforeMove(service, sourceId, targetId)
  if (mittenteDeduped > 0) moved.mittente_fornitore_assoc_stats_deduped = mittenteDeduped
  moved.mittente_fornitore_assoc_stats = await moveRows(
    service,
    'mittente_fornitore_assoc_stats',
    sourceId,
    targetId,
  )

  for (const table of SIMPLE_MOVE_TABLES) {
    moved[table] = await moveRows(service, table, sourceId, targetId)
  }

  moved.ai_action_learning = await moveRows(service, 'ai_action_learning', sourceId, targetId)

  // Hint OCR tipo: unique (fornitore_id, ocr_tipo_key) — rimuovi sorgente se già sul target
  const { data: targetHints } = await service
    .from('fornitore_ocr_tipo_pending_kind_hints')
    .select('ocr_tipo_key')
    .eq('fornitore_id', targetId)
  const hintKeys = new Set((targetHints ?? []).map((h) => (h as { ocr_tipo_key: string }).ocr_tipo_key))
  if (hintKeys.size > 0) {
    const { data: sourceHints } = await service
      .from('fornitore_ocr_tipo_pending_kind_hints')
      .select('id, ocr_tipo_key')
      .eq('fornitore_id', sourceId)
    const hintIdsToDrop = (sourceHints ?? [])
      .filter((h) => hintKeys.has((h as { ocr_tipo_key: string }).ocr_tipo_key))
      .map((h) => (h as { id: string }).id)
    if (hintIdsToDrop.length > 0) {
      await service.from('fornitore_ocr_tipo_pending_kind_hints').delete().in('id', hintIdsToDrop)
    }
  }
  moved.fornitore_ocr_tipo_pending_kind_hints = await moveRows(
    service,
    'fornitore_ocr_tipo_pending_kind_hints',
    sourceId,
    targetId,
  )

  // Email alias: aggiungi quelle mancanti sul target
  const { data: targetEmails } = await service
    .from('fornitore_emails')
    .select('email')
    .eq('fornitore_id', targetId)
  const emailSet = new Set(
    (targetEmails ?? []).map((e) => String((e as { email: string }).email).toLowerCase()),
  )
  if (source.email?.trim()) emailSet.add(source.email.trim().toLowerCase())

  const { data: sourceEmails } = await service
    .from('fornitore_emails')
    .select('id, email, label')
    .eq('fornitore_id', sourceId)

  let emailsMoved = 0
  for (const row of sourceEmails ?? []) {
    const email = String((row as { email: string }).email).toLowerCase()
    if (emailSet.has(email)) continue
    const { error: insErr } = await service.from('fornitore_emails').insert({
      fornitore_id: targetId,
      email,
      label: (row as { label: string | null }).label,
    })
    if (insErr) throw new Error(`fornitore_emails: ${insErr.message}`)
    emailSet.add(email)
    emailsMoved++
  }
  await service.from('fornitore_emails').delete().eq('fornitore_id', sourceId)
  moved.fornitore_emails = emailsMoved

  const patch: Record<string, string | null> = {}
  if (!target.email?.trim() && source.email?.trim()) patch.email = source.email.trim()
  if (!target.piva?.trim() && source.piva?.trim()) patch.piva = source.piva.trim()
  if (!target.display_name?.trim() && source.display_name?.trim()) {
    patch.display_name = source.display_name.trim()
  }
  if (!target.indirizzo?.trim() && source.indirizzo?.trim()) patch.indirizzo = source.indirizzo.trim()
  if (!target.rekki_link?.trim() && source.rekki_link?.trim()) patch.rekki_link = source.rekki_link.trim()
  if (!target.rekki_supplier_id?.trim() && source.rekki_supplier_id?.trim()) {
    patch.rekki_supplier_id = source.rekki_supplier_id.trim()
  }
  if (!target.logo_url?.trim() && source.logo_url?.trim()) patch.logo_url = source.logo_url.trim()
  if (!target.language?.trim() && source.language?.trim()) patch.language = source.language.trim()

  if (Object.keys(patch).length > 0) {
    const { error: patchErr } = await service.from('fornitori').update(patch).eq('id', targetId)
    if (patchErr) throw new Error(patchErr.message)
  }

  const { error: delErr } = await service.from('fornitori').delete().eq('id', sourceId)
  if (delErr) throw new Error(`Eliminazione fornitore sorgente: ${delErr.message}`)

  await logActivity(service, {
    userId,
    sedeId: target.sede_id,
    action: ACTIVITY_ACTIONS.FORNITORE_MERGED,
    entityType: 'fornitore',
    entityId: targetId,
    entityLabel: target.nome,
    metadata: {
      source_id: sourceId,
      source_nome: source.nome,
      moved,
    },
  })

  return { targetId, sourceId, moved, deletedSource: true }
}
