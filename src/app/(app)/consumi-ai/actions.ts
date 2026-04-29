'use server'

import { clearAiUsageLogForAdmin } from '@/lib/ai-usage-clear'

export async function clearAiUsageLogAction(): Promise<
  { ok: true; deleted: number | null; mode: string } | { ok: false; error: string }
> {
  const r = await clearAiUsageLogForAdmin()
  if (!r.ok) {
    return { ok: false, error: r.error }
  }
  return { ok: true, deleted: r.deleted, mode: r.mode }
}
