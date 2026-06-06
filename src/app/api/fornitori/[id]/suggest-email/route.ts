import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { isSharedBillingPlatformSenderEmail } from '@/lib/fornitore-resolve-scan-email'
import {
  discoverFornitoreEmailsFromInbox,
  type InboxDiscoveredEmailSource,
} from '@/lib/fornitore-inbox-email-discovery'

export type EmailSuggestionSource =
  | 'log'
  | 'queue'
  | 'unmatched_queue'
  | InboxDiscoveredEmailSource

export interface EmailSuggestion {
  email: string
  source: EmailSuggestionSource
  count: number
  last_seen: string | null
}

export const maxDuration = 120

function isEmail(s: string | null | undefined): boolean {
  return typeof s === 'string' && s.includes('@') && s.length > 5
}

function normEmail(s: string): string {
  return s.trim().toLowerCase()
}

type FornitoreRow = {
  id: string
  nome: string
  display_name?: string | null
  piva: string | null
  email: string | null
  sede_id: string | null
}

async function loadFornitoreAuth(
  fornitoreId: string,
  userId: string,
): Promise<
  | { ok: true; fornitore: FornitoreRow; service: ReturnType<typeof createServiceClient> }
  | { ok: false; response: NextResponse }
> {
  const service = createServiceClient()

  const { data: fornitore } = await service
    .from('fornitori')
    .select('id, nome, display_name, piva, email, sede_id')
    .eq('id', fornitoreId)
    .maybeSingle()

  if (!fornitore) {
    return { ok: false, response: NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 }) }
  }

  const { data: profile } = await service
    .from('profiles')
    .select('role, sede_id')
    .eq('id', userId)
    .single()

  const isAdmin = profile?.role === 'admin'
  if (!isAdmin && profile?.sede_id && fornitore.sede_id && profile.sede_id !== fornitore.sede_id) {
    return { ok: false, response: NextResponse.json({ error: 'Non autorizzato' }, { status: 403 }) }
  }

  return { ok: true, fornitore, service }
}

async function suggestFromDatabase(
  service: ReturnType<typeof createServiceClient>,
  fornitore: FornitoreRow,
): Promise<{ suggestions: EmailSuggestion[]; billing_platform_only: boolean }> {
  const fornitoreId = fornitore.id

  const { data: aliases } = await service
    .from('fornitore_emails')
    .select('email')
    .eq('fornitore_id', fornitoreId)

  const knownEmails = new Set<string>([
    ...(fornitore.email ? [normEmail(fornitore.email)] : []),
    ...(aliases ?? []).map((a: { email: string }) => normEmail(a.email)),
  ])

  const map = new Map<string, { count: number; last_seen: string | null; source: EmailSuggestionSource }>()
  let billingPlatformDocCount = 0

  function noteBillingPlatformSender(email: string | null | undefined) {
    if (isSharedBillingPlatformSenderEmail(email)) billingPlatformDocCount += 1
  }

  function merge(
    email: string,
    date: string | null | undefined,
    source: EmailSuggestionSource,
  ) {
    const key = normEmail(email)
    if (!isEmail(key) || knownEmails.has(key) || isSharedBillingPlatformSenderEmail(key)) return
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

  const { data: logs } = await service
    .from('log_sincronizzazione')
    .select('mittente, data')
    .eq('fornitore_id', fornitoreId)
    .not('mittente', 'is', null)
    .order('data', { ascending: false })
    .limit(500)

  for (const row of logs ?? []) {
    noteBillingPlatformSender(row.mittente)
    if (isEmail(row.mittente)) merge(row.mittente, row.data, 'log')
  }

  const { data: docs } = await service
    .from('documenti_da_processare')
    .select('mittente, created_at')
    .eq('fornitore_id', fornitoreId)
    .not('mittente', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500)

  for (const row of docs ?? []) {
    noteBillingPlatformSender(row.mittente)
    if (isEmail(row.mittente)) merge(row.mittente, row.created_at, 'queue')
  }

  if (fornitore.piva?.trim()) {
    const piva = fornitore.piva.trim()
    const { data: unmatched } = await service
      .from('documenti_da_processare')
      .select('mittente, created_at, metadata')
      .is('fornitore_id', null)
      .not('mittente', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000)

    for (const row of unmatched ?? []) {
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

  const billing_platform_only = suggestions.length === 0 && billingPlatformDocCount > 0

  return { suggestions, billing_platform_only }
}

function mergeSuggestionLists(lists: EmailSuggestion[][]): EmailSuggestion[] {
  const map = new Map<string, EmailSuggestion>()
  const sourceRank: Record<EmailSuggestionSource, number> = {
    inbox_from: 5,
    inbox_reply_to: 4,
    log: 3,
    queue: 2,
    unmatched_queue: 1,
    inbox_body: 0,
  }

  for (const list of lists) {
    for (const sg of list) {
      const key = normEmail(sg.email)
      const existing = map.get(key)
      if (!existing) {
        map.set(key, { ...sg, email: key })
        continue
      }
      existing.count += sg.count
      if (sg.last_seen && (!existing.last_seen || sg.last_seen > existing.last_seen)) {
        existing.last_seen = sg.last_seen
      }
      if (sourceRank[sg.source] > sourceRank[existing.source]) {
        existing.source = sg.source
      }
    }
  }

  return [...map.values()].sort(
    (a, b) => b.count - a.count || (b.last_seen ?? '').localeCompare(a.last_seen ?? ''),
  )
}

async function buildSuggestEmailResponse(
  service: ReturnType<typeof createServiceClient>,
  fornitore: FornitoreRow,
  scanInbox: boolean,
) {
  const db = await suggestFromDatabase(service, fornitore)

  if (!scanInbox) {
    return NextResponse.json({
      suggestions: db.suggestions,
      billing_platform_only: db.billing_platform_only,
      scanned_inbox: false,
    })
  }

  const { data: aliases } = await service
    .from('fornitore_emails')
    .select('email')
    .eq('fornitore_id', fornitore.id)

  const knownEmails = new Set<string>([
    ...(fornitore.email ? [normEmail(fornitore.email)] : []),
    ...(aliases ?? []).map((a: { email: string }) => normEmail(a.email)),
  ])

  const inbox = await discoverFornitoreEmailsFromInbox(service, fornitore, { knownEmails })

  const suggestions = mergeSuggestionLists([db.suggestions, inbox.suggestions])
  const billing_platform_only =
    suggestions.length === 0 &&
    (db.billing_platform_only || inbox.billing_platform_only) &&
    inbox.inbox_confirmed_known.length === 0

  return NextResponse.json({
    suggestions,
    billing_platform_only,
    scanned_inbox: inbox.scanned,
    inbox_error: inbox.error ?? null,
    inbox_search_terms: inbox.search_terms,
    inbox_mails_matched: inbox.mails_matched,
    inbox_lookback_days: inbox.lookback_days,
    inbox_confirmed_known: inbox.inbox_confirmed_known,
    registered_emails: [...knownEmails],
  })
}

/**
 * GET /api/fornitori/[id]/suggest-email
 * Solo dati già in DB (log, coda, P.IVA).
 *
 * POST body `{ scan_inbox?: true }` — include anche scansione IMAP casella sede.
 */
export async function GET(
  _req: NextRequest,
  segmentCtx: { params: Promise<{ id: string }> },
) {
  const { id: fornitoreId } = await segmentCtx.params
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await loadFornitoreAuth(fornitoreId, user.id)
  if (!auth.ok) return auth.response

  return buildSuggestEmailResponse(auth.service, auth.fornitore, false)
}

export async function POST(
  req: NextRequest,
  segmentCtx: { params: Promise<{ id: string }> },
) {
  const { id: fornitoreId } = await segmentCtx.params
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as { scan_inbox?: boolean }
  const scanInbox = body.scan_inbox !== false

  const auth = await loadFornitoreAuth(fornitoreId, user.id)
  if (!auth.ok) return auth.response

  return buildSuggestEmailResponse(auth.service, auth.fornitore, scanInbox)
}
