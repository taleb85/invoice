import type { SupabaseClient } from '@supabase/supabase-js'

export const ACTIVITY_ACTIONS = {
  BOLLA_CREATED: 'bolla.created',
  BOLLA_DELETED: 'bolla.deleted',
  BOLLA_REASSIGNED: 'bolla.reassigned',
  FATTURA_CREATED: 'fattura.created',
  FATTURA_DELETED: 'fattura.deleted',
  FATTURA_ASSOCIATED: 'fattura.associated',
  FATTURA_APPROVED: 'fattura.approved',
  FATTURA_REJECTED: 'fattura.rejected',
  FATTURA_REASSIGNED: 'fattura.reassigned',
  DOCUMENTO_PROCESSED: 'documento.processed',
  DOCUMENTO_DISCARDED: 'documento.discarded',
  FORNITORE_CREATED: 'fornitore.created',
  FORNITORE_UPDATED: 'fornitore.updated',
  FORNITORE_DELETED: 'fornitore.deleted',
  DUPLICATE_BULK_DELETED: 'duplicate.bulk_deleted',
  OPERATORE_CREATED: 'operatore.created',
  OPERATORE_PIN_CHANGED: 'operatore.pin_changed',
  EMAIL_SYNCED: 'email.synced',
  EMAIL_SCAN_PREFILTRO: 'email.scan.prefiltro',
  PRICE_ANOMALY_RESOLVED: 'price_anomaly.resolved',
  GEMINI_OCR: 'gemini.ocr',
  POTENTIAL_SUPPLIER_CREATED: 'potential_supplier.created',
  POTENTIAL_SUPPLIER_DA_VALUTARE: 'potential_supplier.stato.da_valutare',
  POTENTIAL_SUPPLIER_IN_VALUTAZIONE: 'potential_supplier.stato.in_valutazione',
  POTENTIAL_SUPPLIER_APPROFONDIMENTO: 'potential_supplier.stato.approfondimento',
  POTENTIAL_SUPPLIER_APPROVATO: 'potential_supplier.stato.approvato',
  POTENTIAL_SUPPLIER_RIFIUTATO: 'potential_supplier.stato.rifiutato',
  POTENTIAL_SUPPLIER_ARCHIVIATO: 'potential_supplier.stato.archiviato',
} as const

export type ActivityAction = typeof ACTIVITY_ACTIONS[keyof typeof ACTIVITY_ACTIONS]

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

const GLYPH_MAP: [string, ActivityGlyphId][] = [
  ['bolla', 'package'],
  ['fattura', 'document-text'],
  ['documento', 'clipboard-list'],
  ['fornitore', 'building-store'],
  ['operatore', 'user'],
  ['email', 'mail'],
  ['price', 'currency'],
]

export function activityGlyphId(action: ActivityAction): ActivityGlyphId {
  for (const [prefix, glyph] of GLYPH_MAP) {
    if (action.startsWith(prefix)) return glyph
  }
  if (action === ACTIVITY_ACTIONS.DUPLICATE_BULK_DELETED) return 'trash'
  if (action === ACTIVITY_ACTIONS.GEMINI_OCR) return 'sparkles'
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

const LABEL_MAP: Record<ActivityAction, string> = {
  [ACTIVITY_ACTIONS.BOLLA_CREATED]: 'Bolla registrata',
  [ACTIVITY_ACTIONS.BOLLA_DELETED]: 'Bolla eliminata',
  [ACTIVITY_ACTIONS.BOLLA_REASSIGNED]: 'Bolla riassegnata a fornitore',
  [ACTIVITY_ACTIONS.FATTURA_CREATED]: 'Fattura registrata',
  [ACTIVITY_ACTIONS.FATTURA_DELETED]: 'Fattura eliminata',
  [ACTIVITY_ACTIONS.FATTURA_ASSOCIATED]: 'Fattura associata a bolle',
  [ACTIVITY_ACTIONS.FATTURA_APPROVED]: 'Fattura approvata',
  [ACTIVITY_ACTIONS.FATTURA_REJECTED]: 'Fattura rifiutata',
  [ACTIVITY_ACTIONS.FATTURA_REASSIGNED]: 'Fattura riassegnata a fornitore',
  [ACTIVITY_ACTIONS.DOCUMENTO_PROCESSED]: 'Documento elaborato',
  [ACTIVITY_ACTIONS.DOCUMENTO_DISCARDED]: 'Documento scartato',
  [ACTIVITY_ACTIONS.FORNITORE_CREATED]: 'Fornitore creato',
  [ACTIVITY_ACTIONS.FORNITORE_UPDATED]: 'Fornitore aggiornato',
  [ACTIVITY_ACTIONS.FORNITORE_DELETED]: 'Fornitore eliminato',
  [ACTIVITY_ACTIONS.DUPLICATE_BULK_DELETED]: 'Duplicati eliminati',
  [ACTIVITY_ACTIONS.OPERATORE_CREATED]: 'Operatore creato',
  [ACTIVITY_ACTIONS.OPERATORE_PIN_CHANGED]: 'PIN operatore cambiato',
  [ACTIVITY_ACTIONS.EMAIL_SYNCED]: 'Email sincronizzata',
  [ACTIVITY_ACTIONS.EMAIL_SCAN_PREFILTRO]: 'Scansione email — pre-filtro',
  [ACTIVITY_ACTIONS.PRICE_ANOMALY_RESOLVED]: 'Anomalia prezzo risolta',
  [ACTIVITY_ACTIONS.GEMINI_OCR]: 'Documento elaborato con Gemini',
  [ACTIVITY_ACTIONS.POTENTIAL_SUPPLIER_CREATED]: 'Fornitore potenziale registrato',
  [ACTIVITY_ACTIONS.POTENTIAL_SUPPLIER_DA_VALUTARE]: 'Stato: da valutare',
  [ACTIVITY_ACTIONS.POTENTIAL_SUPPLIER_IN_VALUTAZIONE]: 'Stato: in valutazione',
  [ACTIVITY_ACTIONS.POTENTIAL_SUPPLIER_APPROFONDIMENTO]: 'Stato: approfondimento',
  [ACTIVITY_ACTIONS.POTENTIAL_SUPPLIER_APPROVATO]: 'Fornitore potenziale approvato',
  [ACTIVITY_ACTIONS.POTENTIAL_SUPPLIER_RIFIUTATO]: 'Fornitore potenziale rifiutato',
  [ACTIVITY_ACTIONS.POTENTIAL_SUPPLIER_ARCHIVIATO]: 'Fornitore potenziale archiviato',
}

export function activityLabel(action: ActivityAction): string {
  return LABEL_MAP[action] ?? action
}

export function activityColor(action: ActivityAction): 'green' | 'red' | 'blue' | 'amber' | 'purple' | 'gray' {
  if (action.endsWith('.created') || action.endsWith('.associated') || action === ACTIVITY_ACTIONS.EMAIL_SYNCED) return 'green'
  if (action.endsWith('.deleted') || action.endsWith('.rejected') || action === ACTIVITY_ACTIONS.DUPLICATE_BULK_DELETED) return 'red'
  if (action.endsWith('.approved') || action === ACTIVITY_ACTIONS.PRICE_ANOMALY_RESOLVED) return 'blue'
  if (action.endsWith('.updated') || action.endsWith('.pin_changed')) return 'amber'
  if (action.startsWith('operatore') || action.startsWith('fornitore')) return 'purple'
  if (action.startsWith('email.scan')) return 'blue'
  return 'gray'
}
