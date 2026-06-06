import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/utils/supabase/server'
import { requireAdmin } from '@/lib/api-auth'
import { isMasterAdminRole } from '@/lib/roles'
import { autoProcessAfterFornitoreEmailAdded } from '@/lib/documenti-revisione-auto'
import { logActivity } from '@/lib/activity-logger'
import { isSharedBillingPlatformSenderEmail } from '@/lib/fornitore-resolve-scan-email'

// ── POST /api/fornitori ────────────────────────────────────────────────────────
// Creates a new fornitore for a given sede and registers its email in
// fornitore_emails so the IMAP scan can recognise it automatically.

export async function POST(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { profile } = auth
  const service = createServiceClient()

  const body = await req.json() as {
    nome?: string
    piva?: string
    email?: string
    sede_id?: string
  }

  const nome    = body.nome?.trim()
  const piva    = body.piva?.trim().replace(/\D/g, '') || null
  const email   = body.email?.trim().toLowerCase() || null
  const sede_id = body.sede_id ?? null

  if (!nome) {
    return NextResponse.json({ error: 'La Ragione Sociale è obbligatoria' }, { status: 400 })
  }
  if (!sede_id) {
    return NextResponse.json({ error: 'La Sede è obbligatoria' }, { status: 400 })
  }
  if (email && isSharedBillingPlatformSenderEmail(email)) {
    return NextResponse.json(
      { error: 'Email di piattaforma di fatturazione (Xero, QuickBooks, …): non valida come contatto fornitore.' },
      { status: 400 },
    )
  }

  if (!isMasterAdminRole(profile.role) && profile.sede_id && profile.sede_id !== sede_id) {
    return NextResponse.json({ error: 'Puoi creare fornitori solo per la tua sede' }, { status: 403 })
  }

  // 1. Insert the fornitore record
  const { data: fornitore, error: fornitoreErr } = await service
    .from('fornitori')
    .insert({ nome, piva, email, sede_id })
    .select('id, nome, piva, email, sede_id')
    .single()

  if (fornitoreErr || !fornitore) {
    return NextResponse.json({ error: fornitoreErr?.message ?? 'Errore nel salvataggio' }, { status: 500 })
  }

  await logActivity(service, {
    userId: profile.id,
    sedeId: sede_id,
    action: 'fornitore.created',
    entityType: 'fornitore',
    entityId: fornitore.id,
    entityLabel: fornitore.nome,
  })

  // 2. Register email in fornitore_emails for IMAP matching (ignore errors — non-blocking)
  let retroactive: { processed: number; scanned: number; errors: string[] } | null = null
  if (email) {
    await service.from('fornitore_emails').insert({
      fornitore_id: fornitore.id,
      email,
    })
    try {
      retroactive = await autoProcessAfterFornitoreEmailAdded(service, fornitore.id, email)
    } catch (e) {
      console.warn('[POST /api/fornitori] retroactive reprocess', e)
      retroactive = { processed: 0, scanned: 0, errors: [e instanceof Error ? e.message : String(e)] }
    }
  }

  return NextResponse.json({ fornitore, retroactive }, { status: 201 })
}

// ── DELETE /api/fornitori ──────────────────────────────────────────────────────
// Deletes a fornitore by id (also removes related fornitore_emails rows via DB cascade
// if configured, otherwise we clean them up manually).

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { profile } = auth
  const service = createServiceClient()

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID mancante' }, { status: 400 })

  if (!isMasterAdminRole(profile.role)) {
    const { data: row } = await service.from('fornitori').select('sede_id').eq('id', id).maybeSingle()
    if (!profile.sede_id || row?.sede_id !== profile.sede_id) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }
  }

  // Remove email aliases first (avoid FK constraint if no cascade)
  await service.from('fornitore_emails').delete().eq('fornitore_id', id)

  const { error } = await service.from('fornitori').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
