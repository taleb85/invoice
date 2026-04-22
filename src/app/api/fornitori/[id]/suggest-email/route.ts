import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'

export interface EmailSuggestion {
  email: string
  source: 'log' | 'queue' | 'unmatched_queue'
  count: number
  last_seen: string | null
}

function isEmail(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.includes('@') && s.length > 5
}

function normEmail(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * GET /api/fornitori/[id]/suggest-email
 *
 * Returns candidate email addresses that could belong to this supplier,
 * sourced from existing data without any live IMAP scan:
 *
 *  1. `log_sincronizzazione` rows already linked to this fornitore_id
 *     → these senders are confirmed to have sent docs for this supplier
 *  2. `documenti_da_processare` rows already linked to this fornitore_id
 *     → same logic
 *  3. `documenti_da_processare` rows with fornitore_id IS NULL but whose
 *     OCR metadata.p_iva matches the supplier P.IVA (unmatched because there
 *     was no email alias registered)
 *
 * Emails already saved as the main address or as an alias are excluded.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: fornitoreId } = await params

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const service = createServiceClient()

  // Load the supplier to get piva and verify access
  const { data: fornitore } = await service
    .from('fornitori')
    .select('id, nome, piva, email, sede_id')
    .eq('id', fornitoreId)
    .maybeSingle()

  if (!fornitore) return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })

  // Auth: admin-sede can only access their own sede
  const { data: profile } = await service
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'
  if (!isAdmin && profile?.sede_id && fornitore.sede_id && profile.sede_id !== fornitore.sede_id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  // Collect already-known emails (main + aliases) to exclude from suggestions
  const { data: aliases } = await service
    .from('fornitore_emails')
    .select('email')
    .eq('fornitore_id', fornitoreId)

  const knownEmails = new Set<string>([
    ...(fornitore.email ? [normEmail(fornitore.email)] : []),
    ...(aliases ?? []).map((a: { email: string }) => normEmail(a.email)),
  ])

  // Accumulate suggestions: email → { count, last_seen, source }
  const map = new Map<string, { count: number; last_seen: string | null; source: EmailSuggestion['source'] }>()

  function merge(
    email: string,
    date: string | null | undefined,
    source: EmailSuggestion['source']
  ) {
    const key = normEmail(email)
    if (!isEmail(key) || knownEmails.has(key)) return
    const existing = map.get(key)
    if (existing) {
      existing.count += 1
      if (date && (!existing.last_seen || date > existing.last_seen)) {
        existing.last_seen = date
      }
    } else {
      map.set(key, { count: 1, last_seen: date ?? null, source })
    }
  }

  // Source 1: log_sincronizzazione already linked to this fornitore
  const { data: logs } = await service
    .from('log_sincronizzazione')
    .select('mittente, data')
    .eq('fornitore_id', fornitoreId)
    .not('mittente', 'is', null)
    .order('data', { ascending: false })
    .limit(500)

  for (const row of (logs ?? [])) {
    if (isEmail(row.mittente)) merge(row.mittente, row.data, 'log')
  }

  // Source 2: documenti_da_processare already linked to this fornitore
  const { data: docs } = await service
    .from('documenti_da_processare')
    .select('mittente, created_at')
    .eq('fornitore_id', fornitoreId)
    .not('mittente', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)

  for (const row of (docs ?? [])) {
    if (isEmail(row.mittente)) merge(row.mittente, row.created_at, 'queue')
  }

  // Source 3: unmatched docs in the queue that have a matching P.IVA via OCR metadata
  if (fornitore.piva?.trim()) {
    const piva = fornitore.piva.trim()
    const { data: unmatched } = await service
      .from('documenti_da_processare')
      .select('mittente, created_at, metadata')
      .is('fornitore_id', null)
      .not('mittente', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000)

    for (const row of (unmatched ?? [])) {
      const meta = row.metadata as Record<string, unknown> | null
      const metaPiva = (meta?.p_iva as string | undefined)?.trim()
      if (metaPiva && metaPiva.toUpperCase() === piva.toUpperCase() && isEmail(row.mittente)) {
        merge(row.mittente, row.created_at, 'unmatched_queue')
      }
    }
  }

  const suggestions: EmailSuggestion[] = [...map.entries()]
    .map(([email, v]) => ({ email, ...v }))
    .sort((a, b) => b.count - a.count || (b.last_seen ?? '').localeCompare(a.last_seen ?? ''))

  return NextResponse.json({ suggestions })
}
