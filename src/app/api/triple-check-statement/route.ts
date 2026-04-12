/**
 * POST /api/triple-check-statement
 *
 * Interactive endpoint — kept for backward compatibility.
 * The heavy logic lives in src/lib/triple-check.ts so it can be reused by
 * the automatic scan-emails pipeline.
 *
 * Body:
 *   lines        — array of { numero, importo } parsed from the statement
 *   sede_id      — optional: restrict to a specific branch
 *   fornitore_id — optional: restrict to a single supplier
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { runTripleCheck, type StatementLine } from '@/lib/triple-check'

// Re-export types so existing imports in statements/page.tsx still work
export type { CheckStatus, CheckResult } from '@/lib/triple-check'
export type { StatementLine }

export async function POST(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await req.json() as {
    lines:         StatementLine[]
    sede_id?:      string | null
    fornitore_id?: string | null
  }

  const { lines, sede_id, fornitore_id } = body
  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: 'Nessuna riga da verificare' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { results, summary } = await runTripleCheck(supabase, lines, sede_id, fornitore_id)

  return NextResponse.json({ results, summary })
}
