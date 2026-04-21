import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isAdminSedeRole } from '@/lib/roles'
import { ImapFlow } from 'imapflow'

// ── MIME structure helper ─────────────────────────────────────────────────────

type MimePart = {
  type?: string
  subtype?: string
  disposition?: { type?: string; parameters?: Record<string, string> }
  childNodes?: MimePart[]
}

/** Ricorsivamente controlla se il MIME tree contiene allegati PDF/immagine */
function hasDocumentAttachment(part: MimePart | null | undefined): boolean {
  if (!part) return false
  const type = (part.type ?? '').toUpperCase()
  const dispositionType = (part.disposition?.type ?? '').toUpperCase()

  if (dispositionType === 'ATTACHMENT') return true
  if (type === 'APPLICATION' || type === 'IMAGE') return true

  if (Array.isArray(part.childNodes)) {
    return part.childNodes.some(c => hasDocumentAttachment(c))
  }
  return false
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiscoveredSender {
  email: string
  display_name: string | null
  attachment_count: number
  last_seen: string
  sede_nome: string | null
  sede_id: string | null
}

// ── IMAP Scan (headers only, no content download) ─────────────────────────────

async function scanInboxHeaders(
  host: string,
  port: number,
  user: string,
  password: string,
  sedeNome: string | null,
  sedeId: string | null
): Promise<DiscoveredSender[]> {
  const client = new ImapFlow({
    host,
    port,
    secure: port !== 143,
    auth: { user, pass: password },
    logger: false,
    tls: { rejectUnauthorized: false },
  })

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const senderMap = new Map<string, DiscoveredSender>()

  await client.connect()
  try {
    await client.mailboxOpen('INBOX')

    // Fetch envelope + MIME structure only (no message source download)
    for await (const msg of client.fetch({ since }, { envelope: true, bodyStructure: true })) {
      const fromAddr = msg.envelope?.from?.[0]
      if (!fromAddr?.address) continue

      const email = fromAddr.address.toLowerCase().trim()
      if (!email.includes('@')) continue

      const displayName = fromAddr.name?.trim() || null
      const date = msg.envelope?.date?.toISOString() ?? new Date().toISOString()

      if (!hasDocumentAttachment(msg.bodyStructure as MimePart)) continue

      const existing = senderMap.get(email)
      if (existing) {
        existing.attachment_count++
        if (date > existing.last_seen) existing.last_seen = date
      } else {
        senderMap.set(email, {
          email,
          display_name: displayName,
          attachment_count: 1,
          last_seen: date,
          sede_nome: sedeNome,
          sede_id: sedeId,
        })
      }
    }
  } finally {
    await client.logout()
  }

  return [...senderMap.values()]
}

// ── GET: discover unknown senders ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Only admin and admin_sede can scan IMAP accounts (they expose credentials)
  const profile = await getProfile()
  if (!isMasterAdminRole(profile?.role) && !isAdminSedeRole(profile?.role)) {
    return NextResponse.json({ error: 'Accesso riservato agli amministratori' }, { status: 403 })
  }

  // Optional: restrict scan to one specific branch
  const { searchParams } = new URL(req.url)
  // admin_sede is restricted to their own sede
  const callerSedeId = profile?.sede_id ?? null
  const requestedSedeId = searchParams.get('sede_id') ?? undefined
  const filterSedeId = isAdminSedeRole(profile?.role) ? (callerSedeId ?? undefined) : requestedSedeId

  const service = createServiceClient()

  // Collect all known emails from DB (main + aliases)
  const [{ data: fornitori }, { data: aliasRows }] = await Promise.all([
    service.from('fornitori').select('email').not('email', 'is', null),
    service.from('fornitore_emails').select('email').not('email', 'is', null),
  ])

  const knownEmails = new Set<string>([
    ...(fornitori ?? []).map((f: { email: string | null }) => (f.email ?? '').toLowerCase().trim()),
    ...(aliasRows ?? []).map((f: { email: string | null }) => (f.email ?? '').toLowerCase().trim()),
  ].filter(Boolean))

  // Get sedi with IMAP configured — restricted to one if filterSedeId is set
  let sediQuery = service
    .from('sedi')
    .select('id, nome, imap_host, imap_port, imap_user, imap_password')
    .not('imap_host', 'is', null)
    .not('imap_user', 'is', null)
    .not('imap_password', 'is', null)
  if (filterSedeId) sediQuery = sediQuery.eq('id', filterSedeId) as typeof sediQuery
  const { data: sedi } = await sediQuery

  const allDiscovered: DiscoveredSender[] = []
  const errors: string[] = []

  // Scan per-sede IMAP accounts
  if (sedi && sedi.length > 0) {
    for (const sede of sedi) {
      try {
        const discovered = await scanInboxHeaders(
          sede.imap_host,
          sede.imap_port ?? 993,
          sede.imap_user,
          sede.imap_password,
          sede.nome,
          sede.id
        )
        allDiscovered.push(...discovered)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Sede "${sede.nome}": ${msg}`)
      }
    }
  }

  // Scan global IMAP account (only when not scoped to a specific branch)
  if (!filterSedeId && process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASSWORD) {
    try {
      const discovered = await scanInboxHeaders(
        process.env.IMAP_HOST,
        Number(process.env.IMAP_PORT ?? 993),
        process.env.IMAP_USER,
        process.env.IMAP_PASSWORD,
        'Global',
        null
      )
      allDiscovered.push(...discovered)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Global inbox: ${msg}`)
    }
  }

  // Merge duplicates across sedi, filter known emails
  const mergedMap = new Map<string, DiscoveredSender>()
  for (const sender of allDiscovered) {
    if (knownEmails.has(sender.email)) continue
    const existing = mergedMap.get(sender.email)
    if (existing) {
      existing.attachment_count += sender.attachment_count
      if (sender.last_seen > existing.last_seen) existing.last_seen = sender.last_seen
    } else {
      mergedMap.set(sender.email, { ...sender })
    }
  }

  const unknown = [...mergedMap.values()].sort((a, b) => b.attachment_count - a.attachment_count)

  return NextResponse.json({
    unknown,
    errors,
    scanned_sedi: sedi?.length ?? 0,
    has_global_imap: !!(process.env.IMAP_HOST && process.env.IMAP_USER),
  })
}

// ── POST: create a new fornitore from a discovered email ──────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Only admin and admin_sede can create fornitori via discovery
  const profile = await getProfile()
  if (!isMasterAdminRole(profile?.role) && !isAdminSedeRole(profile?.role)) {
    return NextResponse.json({ error: 'Accesso riservato agli amministratori' }, { status: 403 })
  }

  const body = await req.json() as {
    email: string
    nome: string
    piva?: string
    sede_id?: string | null
  }

  const { email, nome, piva, sede_id } = body
  if (!email?.trim() || !nome?.trim()) {
    return NextResponse.json({ error: 'Email e nome sono obbligatori' }, { status: 400 })
  }

  // admin_sede can only create fornitori in their own sede
  if (isAdminSedeRole(profile?.role) && sede_id && sede_id !== profile?.sede_id) {
    return NextResponse.json({ error: 'Non puoi creare fornitori in un\'altra sede' }, { status: 403 })
  }

  const service = createServiceClient()

  const insertPayload: Record<string, string | null> = {
    email: email.toLowerCase().trim(),
    nome: nome.trim(),
    sede_id: sede_id ?? null,
  }
  if (piva?.trim()) insertPayload.piva = piva.trim().replace(/\D/g, '')

  const { data, error } = await service
    .from('fornitori')
    .insert(insertPayload)
    .select('id, nome, email, sede_id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ fornitore: data }, { status: 201 })
}
