import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isSharedBillingPlatformSenderEmail,
  listSharedBillingPlatformEmailPatterns,
} from '@/lib/fornitore-resolve-scan-email'
import { logger } from '@/lib/logger'

export type CleanupSharedPlatformEmailsResult = {
  aliasesRemoved: number
  primaryEmailsCleared: number
  fornitoreIdsTouched: string[]
}

/**
 * Rimuove email fantasma di piattaforme di fatturazione (Xero, QuickBooks/Intuit, …)
 * da `fornitori.email` e da `fornitore_emails`.
 */
export async function cleanupSharedPlatformFornitoreEmails(
  supabase: SupabaseClient,
  opts?: { sedeId?: string | null },
): Promise<CleanupSharedPlatformEmailsResult> {
  const sedeFilter = opts?.sedeId?.trim() || null
  const patterns = listSharedBillingPlatformEmailPatterns()

  const result: CleanupSharedPlatformEmailsResult = {
    aliasesRemoved: 0,
    primaryEmailsCleared: 0,
    fornitoreIdsTouched: [],
  }
  const touched = new Set<string>()

  for (const pattern of patterns) {
    let fq = supabase.from('fornitori').select('id, email, sede_id').ilike('email', pattern)
    if (sedeFilter) fq = fq.eq('sede_id', sedeFilter)
    const { data: rows, error } = await fq
    if (error) {
      logger.warn('[cleanupSharedPlatformFornitoreEmails] fornitori', error.message)
      continue
    }

    for (const row of rows ?? []) {
      const id = (row as { id: string }).id
      const email = (row as { email?: string | null }).email
      if (!isSharedBillingPlatformSenderEmail(email)) continue

      const { error: upErr } = await supabase.from('fornitori').update({ email: null }).eq('id', id)
      if (upErr) {
        logger.warn('[cleanupSharedPlatformFornitoreEmails] clear primary', id, upErr.message)
        continue
      }
      result.primaryEmailsCleared++
      touched.add(id)
    }

    let aq = supabase.from('fornitore_emails').select('id, fornitore_id, email').ilike('email', pattern)
    if (sedeFilter) {
      const { data: sedeRows } = await supabase.from('fornitori').select('id').eq('sede_id', sedeFilter)
      const ids = (sedeRows ?? []).map((r) => (r as { id: string }).id)
      if (!ids.length) continue
      aq = aq.in('fornitore_id', ids)
    }

    const { data: aliases, error: aliasErr } = await aq
    if (aliasErr) {
      logger.warn('[cleanupSharedPlatformFornitoreEmails] aliases', aliasErr.message)
      continue
    }

    for (const row of aliases ?? []) {
      const aliasId = (row as { id: string }).id
      const fornitoreId = (row as { fornitore_id: string }).fornitore_id
      const email = (row as { email?: string | null }).email
      if (!isSharedBillingPlatformSenderEmail(email)) continue

      const { error: delErr } = await supabase.from('fornitore_emails').delete().eq('id', aliasId)
      if (delErr) {
        logger.warn('[cleanupSharedPlatformFornitoreEmails] delete alias', aliasId, delErr.message)
        continue
      }
      result.aliasesRemoved++
      touched.add(fornitoreId)
    }
  }

  result.fornitoreIdsTouched = [...touched]
  if (result.aliasesRemoved > 0 || result.primaryEmailsCleared > 0) {
    logger.info(
      `[cleanupSharedPlatformFornitoreEmails] ${result.primaryEmailsCleared} email primarie, ${result.aliasesRemoved} alias rimossi (${result.fornitoreIdsTouched.length} fornitori)`,
    )
  }
  return result
}
