import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import { logActivity } from '@/lib/activity-logger'

export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await getProfile()
  if (!isMasterAdminRole(profile?.role) && !isSedePrivilegedRole(profile?.role)) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    id?: string
    is_credit_note?: boolean
  }
  const { id, is_credit_note } = body
  if (!id) return NextResponse.json({ error: 'id obbligatorio' }, { status: 400 })

  const service = createServiceClient()

  if (typeof is_credit_note === 'boolean') {
    const { error } = await service
      .from('fatture')
      .update({ is_credit_note })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logActivity(service, {
    action: 'fattura.reassigned',
    entityType: 'fattura',
    entityId: id,
    entityLabel: is_credit_note ? 'Riclassificata come nota di credito' : 'Riclassificata come fattura',
    userId: user.id,
    sedeId: null,
    metadata: { is_credit_note, origin: 'document-actions-modal' },
  })

  return NextResponse.json({ ok: true, message: 'Tipo aggiornato' })
}
