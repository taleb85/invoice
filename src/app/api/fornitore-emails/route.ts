import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { isSedePrivilegedRole, isMasterAdminRole } from '@/lib/roles'
import { senderAlreadyLinkedToFornitore } from '@/lib/mittente-fornitore-assoc'
import { isSharedBillingPlatformSenderEmail } from '@/lib/fornitore-resolve-scan-email'
import {
  autoProcessAfterFornitoreEmailAdded,
  realignStatementsAfterFornitoreEmailAdded,
  syncAssociatoAuditAfterFornitoreEmailAdded,
  type AssociatoAuditSyncResult,
  type RealignStatementsResult,
} from '@/lib/documenti-revisione-auto'
import { promotePrimaryFornitoreEmailIfEmpty } from '@/lib/fornitore-email-primary'

/** Estrae primo indirizzo email da stringa mittente (header o solo email). */
function extractEmail(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase()
  const fromBrackets =
    /<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/.exec(raw)?.[1]?.toLowerCase()?.trim()
  const bare = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/.exec(trimmed)?.[0]?.toLowerCase()
  return fromBrackets ?? bare ?? (trimmed.includes('@') ? trimmed : null)
}

/**
 * POST body: `{ fornitore_id, email }`
 * Registra l’email tra gli alias del fornitore (stesso comportamento di `/fornitore-emails/remember`).
 */
export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })


  let body: { fornitore_id?: string; email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const fornitoreId = body.fornitore_id?.trim()
  const emailExtracted = body.email?.trim() ? extractEmail(body.email) : null
  if (!fornitoreId || !emailExtracted?.includes('@')) {
    return NextResponse.json({ error: 'fornitore_id ed email valida richiesti' }, { status: 400 })
  }
  if (isSharedBillingPlatformSenderEmail(emailExtracted)) {
    return NextResponse.json(
      { error: 'Email di piattaforma di fatturazione (Xero, QuickBooks, …): non associabile al fornitore.' },
      { status: 400 },
    )
  }

  const service = createServiceClient()
  const { data: profile } = await service.from('profiles').select('role, sede_id').eq('id', user.id).single()
  const master = isMasterAdminRole(profile?.role)
  const sedeAdmin = isSedePrivilegedRole(profile?.role)
  if (!master && !sedeAdmin) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const { data: f } = await service.from('fornitori').select('id, sede_id').eq('id', fornitoreId).maybeSingle()
  if (!f) return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })

  if (sedeAdmin && profile?.sede_id && f.sede_id && profile.sede_id !== f.sede_id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  if (await senderAlreadyLinkedToFornitore(service, emailExtracted, fornitoreId)) {
    let associatoSync: AssociatoAuditSyncResult = {
      documentsSynced: 0,
      fattureSynced: 0,
      bolleSynced: 0,
    }
    try {
      associatoSync = await syncAssociatoAuditAfterFornitoreEmailAdded(
        service,
        fornitoreId,
        emailExtracted,
      )
    } catch (e) {
      console.warn('[POST /api/fornitore-emails] associatoSync (alreadyLinked)', e)
    }
    const associatoResolved =
      associatoSync.documentsSynced + associatoSync.fattureSynced + associatoSync.bolleSynced
    try {
      await promotePrimaryFornitoreEmailIfEmpty(service, fornitoreId, emailExtracted)
    } catch (e) {
      console.warn('[POST /api/fornitore-emails] promotePrimary (alreadyLinked)', e)
    }
    return NextResponse.json({ ok: true, alreadyLinked: true, associatoSync, associatoResolved })
  }

  const { error } = await service.from('fornitore_emails').insert([
    { fornitore_id: fornitoreId, email: emailExtracted, label: 'Abbinamenti Inbox AI' },
  ])

  if (error) {
    if (error.code === '23505') {
      try {
        await promotePrimaryFornitoreEmailIfEmpty(service, fornitoreId, emailExtracted)
      } catch (e) {
        console.warn('[POST /api/fornitore-emails] promotePrimary (23505)', e)
      }
      return NextResponse.json({ ok: true, alreadyLinked: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  try {
    await promotePrimaryFornitoreEmailIfEmpty(service, fornitoreId, emailExtracted)
  } catch (e) {
    console.warn('[POST /api/fornitore-emails] promotePrimary', e)
  }

  let retroactive: { processed: number; scanned: number; errors: string[] } | null = null
  try {
    retroactive = await autoProcessAfterFornitoreEmailAdded(service, fornitoreId, emailExtracted)
  } catch (e) {
    console.warn('[POST /api/fornitore-emails] retroactive', e)
    retroactive = { processed: 0, scanned: 0, errors: [e instanceof Error ? e.message : String(e)] }
  }

  let realigned: RealignStatementsResult | null = null
  try {
    realigned = await realignStatementsAfterFornitoreEmailAdded(service, fornitoreId, emailExtracted)
  } catch (e) {
    console.warn('[POST /api/fornitore-emails] realignStatements', e)
    realigned = {
      documentsRebound: 0,
      statementsRebound: 0,
      statementRowsReset: 0,
      errors: [e instanceof Error ? e.message : String(e)],
    }
  }

  let associatoSync: AssociatoAuditSyncResult | null = null
  try {
    associatoSync = await syncAssociatoAuditAfterFornitoreEmailAdded(
      service,
      fornitoreId,
      emailExtracted,
    )
  } catch (e) {
    console.warn('[POST /api/fornitore-emails] associatoSync', e)
    associatoSync = { documentsSynced: 0, fattureSynced: 0, bolleSynced: 0 }
  }

  const associatoResolved =
    (associatoSync?.documentsSynced ?? 0) +
    (associatoSync?.fattureSynced ?? 0) +
    (associatoSync?.bolleSynced ?? 0)

  return NextResponse.json({ ok: true, retroactive, realigned, associatoSync, associatoResolved })
}
