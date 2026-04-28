import type { SupabaseClient } from '@supabase/supabase-js'

/** Motivi salvati su `email_scan_blacklist.motivo` (allineamento DB). */
export const EMAIL_BLACKLIST_MOTIVI = [
  'newsletter',
  'spam',
  'non_fornitore',
  'sistema',
  'social',
] as const

export type EmailBlacklistMotivo = (typeof EMAIL_BLACKLIST_MOTIVI)[number]

export function parseEmailBlacklistMotivo(raw: unknown): EmailBlacklistMotivo | null {
  return typeof raw === 'string' && EMAIL_BLACKLIST_MOTIVI.includes(raw as EmailBlacklistMotivo)
    ? (raw as EmailBlacklistMotivo)
    : null
}

/**
 * Possibili forme chiave compatibili con `lower(mittente)` nel DB match case-insensitive
 * (mittente salvato può essere email nuda o intestazione completa).
 */
export function emailScanBlacklistLookupKeys(fromHeader: string): string[] {
  const t = fromHeader.trim().toLowerCase()
  const keys = new Set<string>()
  if (t) keys.add(t)
  const m = /<([^>]+@[^>]+)>/.exec(fromHeader)
  if (m) keys.add(m[1].trim().toLowerCase())
  const bareAt = /^[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+$/i.exec(t.trim())
  if (bareAt) keys.add(bareAt[0].toLowerCase())
  return [...keys]
}

export function senderMatchesEmailScanBlacklist(
  blacklistLower: Set<string>,
  fromHeader: string,
): boolean {
  for (const k of emailScanBlacklistLookupKeys(fromHeader)) {
    if (blacklistLower.has(k)) return true
  }
  return false
}

/** Carica `lower(mittente)` per sede — confronto senza OCR / log sul mittente saltato. */
export async function loadEmailScanBlacklistSet(
  supabase: SupabaseClient,
  sedeId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('email_scan_blacklist')
    .select('mittente')
    .eq('sede_id', sedeId)

  if (error) {
    console.error('[email-scan-blacklist] load:', error.message)
    return new Set()
  }

  const out = new Set<string>()
  for (const row of data ?? []) {
    const m = (row as { mittente?: string }).mittente
    const k = typeof m === 'string' ? m.trim().toLowerCase() : ''
    if (k) out.add(k)
  }
  return out
}

/** Normalizza input utente prima di INSERT (coerenza con match). */
export function normalizeBlacklistMittente(input: string): string {
  return input.trim().toLowerCase()
}
