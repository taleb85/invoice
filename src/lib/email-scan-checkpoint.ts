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

/**
 * Modalità cron / sync giornaliero: skip se è già presente una riga di log terminale per questo fingerprint.
 */
async function scanUnitLooksClosedInStandardLog(
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

/**
 * Sync storica (`mode=historical`): salta solo se l’unità è veramente consolidata —
 * log positivo (`successo` / `fornitore_suggerito`) e documento collegato `associato` con importo OCR
 * persistito su fattura o bolla (no NULL “vuoti”).
 */
async function scanUnitHistoricalShouldSkipFullyLinked(
  supabase: SupabaseClient,
  fingerprint: string,
): Promise<boolean> {
  const { data: rows, error } = await supabase
    .from('log_sincronizzazione')
    .select('stato, file_url')
    .eq('scan_attachment_fingerprint', fingerprint)
    .order('data', { ascending: false })
    .limit(1)

  if (error) {
    console.warn('[SCAN] storico fingerprint lookup:', error.message)
    return false
  }
  const row = rows?.[0]
  if (!row) return false

  if (row.stato === 'fornitore_non_trovato' || row.stato === 'bolla_non_trovata') {
    return false
  }

  if (row.stato !== 'successo' && row.stato !== 'fornitore_suggerito') {
    return false
  }

  const fileUrl = row.file_url?.trim()
  if (!fileUrl) return false

  const { data: docs, error: docErr } = await supabase
    .from('documenti_da_processare')
    .select('id, stato, fattura_id, bolla_id')
    .eq('file_url', fileUrl)
    .limit(1)

  if (docErr || !docs?.length) return false

  const doc = docs[0]
  if (doc.stato !== 'associato') return false

  if (doc.fattura_id) {
    const { data: f } = await supabase
      .from('fatture')
      .select('importo')
      .eq('id', doc.fattura_id)
      .maybeSingle()
    if (f?.importo != null && Number.isFinite(Number(f.importo))) return true
    return false
  }

  if (doc.bolla_id) {
    const { data: b } = await supabase
      .from('bolle')
      .select('importo')
      .eq('id', doc.bolla_id)
      .maybeSingle()
    if (b?.importo != null && Number.isFinite(Number(b.importo))) return true
    return false
  }

  return false
}

export type ScanCheckpointMode = 'standard' | 'historical'

/**
 * True → non rieseguire OCR su questa unità (la stessa impronta risulta già «chiusa» per la modalità scelta).
 */
export async function isScanUnitAlreadyCompleted(
  supabase: SupabaseClient,
  fingerprint: string,
  mode: ScanCheckpointMode = 'standard',
): Promise<boolean> {
  if (mode === 'historical') {
    return scanUnitHistoricalShouldSkipFullyLinked(supabase, fingerprint)
  }
  return scanUnitLooksClosedInStandardLog(supabase, fingerprint)
}
