import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { senderAlreadyLinkedToFornitore } from '@/lib/mittente-fornitore-assoc'
import { autoProcessAfterFornitoreEmailAdded } from '@/lib/documenti-revisione-auto'

/**
 * Salva l'email del mittente come alias del fornitore (scansione IMAP futura).
 * Usa service client per bypassare RLS su fornitore_emails dove necessario.
 */
export async function POST(req: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body: { fornitore_id?: string; email?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON non valido' }, { status: 400 })
  }

  const fornitoreId = body.fornitore_id?.trim()
  const emailRaw = body.email?.trim().toLowerCase()
  if (!fornitoreId || !emailRaw?.includes('@')) {
    return NextResponse.json({ error: 'fornitore_id ed email valida richiesti' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: profile } = await service.from('profiles').select('role, sede_id').eq('id', user.id).single()
  const { data: f } = await service.from('fornitori').select('id, sede_id').eq('id', fornitoreId).maybeSingle()
  if (!f) return NextResponse.json({ error: 'Fornitore non trovato' }, { status: 404 })

  const isAdmin = profile?.role === 'admin'
  if (!isAdmin && profile?.sede_id && f.sede_id && profile.sede_id !== f.sede_id) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  if (await senderAlreadyLinkedToFornitore(service, emailRaw, fornitoreId)) {
    return NextResponse.json({ ok: true, alreadyLinked: true })
  }

  const { error } = await service.from('fornitore_emails').insert([
    { fornitore_id: fornitoreId, email: emailRaw, label: 'Ricordato da scansione' },
  ])

  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true, alreadyLinked: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let retroactive: { processed: number; scanned: number; errors: string[] } | null = null
  try {
    retroactive = await autoProcessAfterFornitoreEmailAdded(service, fornitoreId, emailRaw)
  } catch (e) {
    console.warn('[POST /api/fornitore-emails/remember] retroactive', e)
    retroactive = { processed: 0, scanned: 0, errors: [e instanceof Error ? e.message : String(e)] }
  }

  return NextResponse.json({ ok: true, retroactive })
}
