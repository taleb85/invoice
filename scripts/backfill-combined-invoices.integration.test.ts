/**
 *   BACKFILL_COMBINED=1 SEDE_ID=... [FORNITORE_ID=...] npx vitest run scripts/backfill-combined-invoices.integration.test.ts
 */
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { backfillCombinedInvoicesForStatements } from '@/lib/statement-combined-pdf-invoice'

const enabled = process.env.BACKFILL_COMBINED === '1'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const sedeId = process.env.SEDE_ID?.trim()
const fornitoreId = process.env.FORNITORE_ID?.trim() || null

describe.skipIf(!enabled)('backfill-combined-invoices', () => {
  it('collega fatture da PDF combinati', async () => {
    if (!url || !key || !sedeId) throw new Error('Env mancante')
    if (!process.env.GEMINI_API_KEY?.trim()) throw new Error('GEMINI_API_KEY mancante')
    const sb = createClient(url, key)
    const result = await backfillCombinedInvoicesForStatements(sb, {
      sedeId,
      fornitoreId,
      limit: Number(process.env.BACKFILL_LIMIT ?? 10),
    })
    console.log(JSON.stringify(result, null, 2))
    expect(result.attempted).toBeGreaterThanOrEqual(0)
  }, 600_000)
})
