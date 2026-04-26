import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isAdminSedeRole } from '@/lib/roles'
import { logActivity } from '@/lib/activity-logger'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const profile = await getProfile()
  const isMaster = isMasterAdminRole(profile?.role)
  const isAdminSede = isAdminSedeRole(profile?.role)
  if (!isMaster && !isAdminSede) {
    return NextResponse.json({ error: 'Accesso negato — solo admin possono approvare' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    fattura_id?: string
    action?: 'approve' | 'reject'
    reason?: string
  }
  const { fattura_id, action, reason } = body

  if (!fattura_id || !action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'fattura_id e action (approve|reject) obbligatori' }, { status: 400 })
  }

  const service = createServiceClient()

  // Fetch the fattura to verify sede access
  const { data: fattura, error: fetchErr } = await service
    .from('fatture')
    .select('id, sede_id, fornitore_id, importo, approval_status, fornitori(nome)')
    .eq('id', fattura_id)
    .single()

  if (fetchErr || !fattura) {
    return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })
  }

  // admin_sede can only approve fatture from their own sede
  if (isAdminSede && !isMaster && profile?.sede_id !== (fattura as { sede_id?: string }).sede_id) {
    return NextResponse.json({ error: 'Accesso negato a questa fattura' }, { status: 403 })
  }

  const now = new Date().toISOString()
  const updatePayload =
    action === 'approve'
      ? {
          approval_status: 'approved',
          approved_by: user.id,
          approved_at: now,
          rejection_reason: null,
        }
      : {
          approval_status: 'rejected',
          rejection_reason: reason?.trim() || 'Nessun motivo specificato',
          approved_by: null,
          approved_at: null,
        }

  const { data: updated, error: updateErr } = await service
    .from('fatture')
    .update(updatePayload)
    .eq('id', fattura_id)
    .select('id, approval_status, approved_at, rejection_reason')
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Fire-and-forget: log activity
  const fFornitore = (fattura as { fornitore_id?: string | null }).fornitore_id
  logActivity(service, {
    userId: user.id,
    sedeId: profile?.sede_id ?? (fattura as { sede_id?: string }).sede_id ?? null,
    action: action === 'approve' ? 'fattura.approved' : 'fattura.rejected',
    entityType: 'fattura',
    entityId: fattura_id,
    entityLabel: (fattura as { fornitori?: { nome?: string | null } | null }).fornitori?.nome ?? undefined,
    metadata: {
      ...(fFornitore ? { fornitore_id: fFornitore } : {}),
      ...(action === 'reject' && reason?.trim() ? { reason: reason.trim() } : {}),
    },
  }).catch(() => {})

  // Fire-and-forget push notification
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '') || 'http://localhost:3000'
  const sedeId = (fattura as { sede_id?: string }).sede_id
  const actionLabel = action === 'approve' ? 'approvata' : 'rifiutata'
  const fornitoreNome =
    (fattura as { fornitori?: { nome?: string | null } | null }).fornitori?.nome ?? 'Fornitore'
  fetch(`${baseUrl}/api/push/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {}),
    },
    body: JSON.stringify({
      title: `Fattura ${actionLabel}`,
      body: `La fattura di ${fornitoreNome} è stata ${actionLabel}`,
      url: `/fatture/${fattura_id}`,
      ...(sedeId ? { sede_id: sedeId } : {}),
    }),
  }).catch(() => {})

  return NextResponse.json({ ok: true, fattura: updated })
}
