import { type NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(s: string): boolean {
  return UUID_RE.test(s)
}

type DeviceRow = {
  id: string
  device_id: string
  profile_id: string
  sede_id: string
  device_name: string | null
  last_seen_at: string | null
  created_at: string
}

/**
 * GET ?deviceId= — trova dispositivo, aggiorna last_seen, profilo + sede (service role).
 * Pubblico: il deviceId è l’“segreto” lato client.
 */
export async function GET(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get('deviceId')?.trim() ?? ''
  if (!deviceId || !isUuid(deviceId)) {
    return NextResponse.json({ notFound: true as const, error: 'deviceId mancante o non valido' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: devRow, error: devErr } = await service
    .from('device_sessions')
    .select('id, device_id, profile_id, sede_id, device_name, last_seen_at, created_at')
    .eq('device_id', deviceId)
    .maybeSingle()

  if (devErr) {
    console.error('[device-sessions GET]', devErr)
    return NextResponse.json({ notFound: true as const }, { status: 500 })
  }
  if (!devRow) {
    return NextResponse.json({ notFound: true as const })
  }
  const row = devRow as DeviceRow

  const [{ data: prof, error: pErr }, { data: sede, error: sErr }] = await Promise.all([
    service.from('profiles').select('id, email, full_name, role, sede_id').eq('id', row.profile_id).maybeSingle(),
    service.from('sedi').select('id, nome, country_code').eq('id', row.sede_id).maybeSingle(),
  ])
  if (pErr || !prof || sErr || !sede) {
    return NextResponse.json({ notFound: true as const }, { status: 404 })
  }

  const now = new Date().toISOString()
  await service.from('device_sessions').update({ last_seen_at: now }).eq('id', row.id)

  return NextResponse.json({
    notFound: false as const,
    profile: {
      id: prof.id,
      email: prof.email,
      full_name: prof.full_name,
      role: String(prof.role ?? '').toLowerCase(),
      sede_id: prof.sede_id,
    },
    sede: {
      id: sede.id,
      nome: sede.nome,
      country_code: (sede as { country_code?: string | null }).country_code ?? null,
    },
  })
}

type PostBody = {
  deviceId?: string
  profileId?: string
  sedeId?: string
  deviceName?: string | null
}

/**
 * POST — registra / aggiorna dispositivo (utente autenticato, profileId = sessione).
 */
export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: PostBody
  try {
    body = (await req.json()) as PostBody
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }

  const deviceId = String(body.deviceId ?? '').trim()
  const profileId = String(body.profileId ?? '').trim()
  const sedeId = String(body.sedeId ?? '').trim()
  const deviceName = typeof body.deviceName === 'string' ? body.deviceName.trim().slice(0, 200) : null

  if (!isUuid(deviceId) || !isUuid(profileId) || !isUuid(sedeId)) {
    return NextResponse.json({ error: 'deviceId, profileId o sedeId non validi' }, { status: 400 })
  }
  if (profileId !== user.id) {
    return NextResponse.json({ error: 'profileId non corrisponde alla sessione' }, { status: 403 })
  }

  const service = createServiceClient()
  const { data: prof, error: pErr } = await service
    .from('profiles')
    .select('id, role, sede_id')
    .eq('id', user.id)
    .maybeSingle()

  if (pErr || !prof) {
    return NextResponse.json({ error: 'Profilo non trovato' }, { status: 400 })
  }
  const r = String(prof.role ?? '').toLowerCase()
  if (r !== 'operatore' && r !== 'admin_sede' && r !== 'admin_tecnico') {
    return NextResponse.json({ error: 'Solo operatore o staff sede (resp./tecnico)' }, { status: 403 })
  }
  if (String(prof.sede_id ?? '') !== sedeId) {
    return NextResponse.json({ error: 'sedeId non coerente con il profilo' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { error: upErr } = await service.from('device_sessions').upsert(
    {
      device_id: deviceId,
      profile_id: profileId,
      sede_id: sedeId,
      device_name: deviceName,
      last_seen_at: now,
    } as never,
    { onConflict: 'device_id' }
  )

  if (upErr) {
    console.error('[device-sessions POST]', upErr)
    return NextResponse.json({ error: 'Salvataggio non riuscito' }, { status: 500 })
  }

  return NextResponse.json({ success: true as const })
}

/**
 * DELETE ?deviceId= — rimuove la registrazione dispositivo.
 */
export async function DELETE(req: NextRequest) {
  const deviceId = req.nextUrl.searchParams.get('deviceId')?.trim() ?? ''
  if (!deviceId || !isUuid(deviceId)) {
    return NextResponse.json({ error: 'deviceId mancante o non valido' }, { status: 400 })
  }
  const service = createServiceClient()
  const { error } = await service.from('device_sessions').delete().eq('device_id', deviceId)
  if (error) {
    console.error('[device-sessions DELETE]', error)
    return NextResponse.json({ error: 'Eliminazione non riuscita' }, { status: 500 })
  }
  return NextResponse.json({ success: true as const })
}
