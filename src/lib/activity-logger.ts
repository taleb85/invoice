import type { SupabaseClient } from '@supabase/supabase-js'

export type ActivityAction =
  | 'bolla.created'
  | 'bolla.deleted'
  | 'fattura.created'
  | 'fattura.deleted'
  | 'fattura.associated'
  | 'fattura.approved'
  | 'fattura.rejected'
  | 'documento.processed'
  | 'documento.discarded'
  | 'fornitore.created'
  | 'fornitore.updated'
  | 'fornitore.deleted'
  | 'duplicate.bulk_deleted'
  | 'operatore.created'
  | 'operatore.pin_changed'
  | 'email.synced'
  | 'email.scan.prefiltro'
  | 'price_anomaly.resolved'
  | 'gemini.ocr'

/** ID stabile per icona SVG nel feed attività (JSON-safe dalla API). */
export type ActivityGlyphId =
  | 'package'
  | 'document-text'
  | 'clipboard-list'
  | 'building-store'
  | 'user'
  | 'mail'
  | 'currency'
  | 'trash'
  | 'sparkles'
  | 'adjustments-horizontal'

export function activityGlyphId(action: ActivityAction): ActivityGlyphId {
  if (action.startsWith('bolla')) return 'package'
  if (action.startsWith('fattura')) return 'document-text'
  if (action.startsWith('documento')) return 'clipboard-list'
  if (action.startsWith('fornitore')) return 'building-store'
  if (action.startsWith('operatore')) return 'user'
  if (action.startsWith('email')) return 'mail'
  if (action.startsWith('price')) return 'currency'
  if (action === 'duplicate.bulk_deleted') return 'trash'
  if (action === 'gemini.ocr') return 'sparkles'
  return 'adjustments-horizontal'
}

/**
 * Inserisce in `activity_log`. Le policy RLS ammettono INSERT solo con **service role**
 * (vedi `20260421100000_create_activity_log.sql`): passa `createServiceClient()` come primo
 * argomento dalle API route, non il client con sessione utente.
 */
export async function logActivity(
  supabase: SupabaseClient,
  opts: {
    userId: string
    sedeId: string | null
    action: ActivityAction
    entityType: string
    entityId?: string
    entityLabel?: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await supabase.from('activity_log').insert([
      {
        user_id: opts.userId,
        sede_id: opts.sedeId,
        action: opts.action,
        entity_type: opts.entityType,
        entity_id: opts.entityId ?? null,
        entity_label: opts.entityLabel ?? null,
        metadata: opts.metadata ?? null,
      },
    ])
  } catch (err) {
    console.error('[activity-logger] Failed to log activity:', err)
  }
}

export function activityLabel(action: ActivityAction): string {
  const labels: Record<ActivityAction, string> = {
    'bolla.created': 'Bolla registrata',
    'bolla.deleted': 'Bolla eliminata',
    'fattura.created': 'Fattura registrata',
    'fattura.deleted': 'Fattura eliminata',
    'fattura.associated': 'Fattura associata a bolle',
    'fattura.approved': 'Fattura approvata',
    'fattura.rejected': 'Fattura rifiutata',
    'documento.processed': 'Documento elaborato',
    'documento.discarded': 'Documento scartato',
    'fornitore.created': 'Fornitore creato',
    'fornitore.updated': 'Fornitore aggiornato',
    'fornitore.deleted': 'Fornitore eliminato',
    'duplicate.bulk_deleted': 'Duplicati eliminati',
    'operatore.created': 'Operatore creato',
    'operatore.pin_changed': 'PIN operatore cambiato',
    'email.synced': 'Email sincronizzata',
    'email.scan.prefiltro': 'Scansione email — pre-filtro',
    'price_anomaly.resolved': 'Anomalia prezzo risolta',
    'gemini.ocr': 'Documento elaborato con Gemini',
  }
  return labels[action] ?? action
}

export function activityColor(action: ActivityAction): 'green' | 'red' | 'blue' | 'amber' | 'purple' | 'gray' {
  if (action.endsWith('.created') || action.endsWith('.associated') || action === 'email.synced') return 'green'
  if (action.endsWith('.deleted') || action.endsWith('.rejected') || action === 'duplicate.bulk_deleted') return 'red'
  if (action.endsWith('.approved') || action === 'price_anomaly.resolved') return 'blue'
  if (action.endsWith('.updated') || action.endsWith('.pin_changed')) return 'amber'
  if (action.startsWith('operatore') || action.startsWith('fornitore')) return 'purple'
  if (action.startsWith('email.scan')) return 'blue'
  return 'gray'
}
