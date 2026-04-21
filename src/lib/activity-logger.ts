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
  | 'operatore.created'
  | 'operatore.pin_changed'
  | 'email.synced'
  | 'price_anomaly.resolved'

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
    'operatore.created': 'Operatore creato',
    'operatore.pin_changed': 'PIN operatore cambiato',
    'email.synced': 'Email sincronizzata',
    'price_anomaly.resolved': 'Anomalia prezzo risolta',
  }
  return labels[action] ?? action
}

export function activityColor(action: ActivityAction): 'green' | 'red' | 'blue' | 'amber' | 'purple' | 'gray' {
  if (action.endsWith('.created') || action.endsWith('.associated') || action === 'email.synced') return 'green'
  if (action.endsWith('.deleted') || action.endsWith('.rejected')) return 'red'
  if (action.endsWith('.approved') || action === 'price_anomaly.resolved') return 'blue'
  if (action.endsWith('.updated') || action.endsWith('.pin_changed')) return 'amber'
  if (action.startsWith('operatore') || action.startsWith('fornitore')) return 'purple'
  return 'gray'
}

export function activityIcon(action: ActivityAction): string {
  if (action.startsWith('bolla')) return '📦'
  if (action.startsWith('fattura')) return '📄'
  if (action.startsWith('documento')) return '📋'
  if (action.startsWith('fornitore')) return '🏪'
  if (action.startsWith('operatore')) return '👤'
  if (action.startsWith('email')) return '📧'
  if (action.startsWith('price')) return '💰'
  return '🔧'
}
