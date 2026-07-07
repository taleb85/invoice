import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'
import { isSedePrivilegedRole, isMasterAdminRole } from '@/lib/roles'
import {
  SESSION_POLICY_CHIAVI,
  fetchSessionPolicy,
  upsertSessionPolicyChiave,
  type SessionPolicyRecord,
} from '@/lib/session-policy-store'

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
  if (!role || !isSedePrivilegedRole(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  const policy = await fetchSessionPolicy(service)
  return NextResponse.json(policy satisfies SessionPolicyRecord)
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
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'expected JSON body' }, { status: 400 })
  }

  const allChiavi = new Set<string>(
    Object.values(SESSION_POLICY_CHIAVI).flatMap((r) => [r.maxAge, r.inactivity]),
  )

  const service = createServiceClient()
  const entries = Object.entries(body as Record<string, unknown>)

  for (const [chiave, raw] of entries) {
    if (!allChiavi.has(chiave)) {
      return NextResponse.json(
        { error: `unknown chiave: ${chiave}` },
        { status: 400 },
      )
    }
    const valore = String(raw)
    if (!/^\d+$/.test(valore) || Number(valore) <= 0) {
      return NextResponse.json(
        { error: `${chiave} must be a positive integer` },
        { status: 400 },
      )
    }
    const ok = await upsertSessionPolicyChiave(service, chiave, valore)
    if (!ok) {
      return NextResponse.json(
        { error: `failed to save ${chiave}` },
        { status: 500 },
      )
    }
  }

  // Return the full updated policy
  const policy = await fetchSessionPolicy(service)
  return NextResponse.json(policy satisfies SessionPolicyRecord)
}
