import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

const PREFIX_LEN = 8192

export type ScanFingerprintInput = {
  sedeId: string | null | undefined
  imapUid: number
  filename: string | null | undefined
  content: Buffer | null | undefined
  kind: 'attachment' | 'body_only'
}

/** Chiave deterministica per allegato o messaggio solo-testo (stessa sede + stesso UID + stesso contenuto). */
export function buildScanAttachmentFingerprint(input: ScanFingerprintInput): string {
  const sede = input.sedeId?.trim() || 'global'
  if (input.kind === 'body_only') {
    const raw = input.content ?? Buffer.alloc(0)
    const h = createHash('sha256').update(raw).digest('hex').slice(0, 28)
    return `${sede}:uid${input.imapUid}:body:${h}`
  }
  const buf = input.content ?? Buffer.alloc(0)
  const prefix = createHash('sha256')
    .update(buf.subarray(0, Math.min(PREFIX_LEN, buf.length)))
    .digest('hex')
    .slice(0, 20)
  const name = (input.filename ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  return `${sede}:uid${input.imapUid}:file:${name}:${buf.length}:${prefix}`
}

const TERMINAL_SCAN_STATI = [
  'successo',
  'fornitore_suggerito',
  'fornitore_non_trovato',
  'bolla_non_trovata',
] as const

/** True se questa unità è già stata chiusa in log (OCR + persistenza completati in un run precedente). */
export async function isScanUnitAlreadyCompleted(
  supabase: SupabaseClient,
  fingerprint: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('log_sincronizzazione')
    .select('id')
    .eq('scan_attachment_fingerprint', fingerprint)
    .in('stato', [...TERMINAL_SCAN_STATI])
    .limit(1)

  if (error) {
    console.warn('[SCAN] lookup fingerprint fallito (proseguo senza skip):', error.message)
    return false
  }
  return (data?.length ?? 0) > 0
}
