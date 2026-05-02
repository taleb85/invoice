import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isMasterAdminRole } from '@/lib/roles'
import {
  BACKUP_AUTOMATION_CHIAVE,
  BACKUP_AUTOMATION_DESCRIZIONE,
  fetchBackupAutomationEnabled,
} from '@/lib/backup-automation'

async function resolveRole(): Promise<string | null> {
  const { user } = await getRequestAuth()
  if (!user) return null
  const full = await getProfile()
  let role = full?.role ?? null
  if (!role || String(role).trim() === '') {
    const service = createServiceClient()
    const { data } = await service.from('profiles').select('role').eq('id', user.id).maybeSingle()
    role = data?.role ?? null
  }
  return role
}

export async function GET() {
  const { user } = await getRequestAuth()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = await resolveRole()
  if (!role || !isMasterAdminRole(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  const enabled = await fetchBackupAutomationEnabled(service)
  return NextResponse.json({ enabled })
}

export async function PATCH(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const role = await resolveRole()
  if (!role || !isMasterAdminRole(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const enabledRaw = body && typeof body === 'object' && 'enabled' in body ? (body as { enabled: unknown }).enabled : undefined
  if (typeof enabledRaw !== 'boolean') {
    return NextResponse.json({ error: 'expected { enabled: boolean }' }, { status: 400 })
  }

  const service = createServiceClient()
  const valore = enabledRaw ? 'true' : 'false'

  const upd = await service
    .from('configurazioni_app')
    .update({ valore, descrizione: BACKUP_AUTOMATION_DESCRIZIONE })
    .eq('chiave', BACKUP_AUTOMATION_CHIAVE)
    .select('chiave')
    .maybeSingle()

  if (upd.error) {
    console.error('[backup/automation] update', upd.error.message)
    return NextResponse.json({ error: 'save_failed' }, { status: 500 })
  }

  if (!upd.data?.chiave) {
    const ins = await service.from('configurazioni_app').insert({
      chiave: BACKUP_AUTOMATION_CHIAVE,
      valore,
      descrizione: BACKUP_AUTOMATION_DESCRIZIONE,
    })
    if (ins.error) {
      if (ins.error.code === '23505') {
        const retry = await service
          .from('configurazioni_app')
          .update({ valore, descrizione: BACKUP_AUTOMATION_DESCRIZIONE })
          .eq('chiave', BACKUP_AUTOMATION_CHIAVE)
        if (retry.error) {
          return NextResponse.json({ error: 'save_failed' }, { status: 500 })
        }
      } else {
        return NextResponse.json({ error: 'save_failed' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ enabled: enabledRaw })
}
