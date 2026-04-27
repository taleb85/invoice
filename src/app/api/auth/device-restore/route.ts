import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/utils/supabase/server'
import { createAuthSessionForEmailViaMagicOtp } from '@/lib/device-session-restore'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(s: string): boolean {
  return UUID_RE.test(s)
}

type Body = { deviceId?: string }

/**
 * Crea la sessione Supabase (cookie) per il profilo collegato a `deviceId`, se presente in `device_sessions`.
 */
export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Body JSON non valido' }, { status: 400 })
  }
  const deviceId = String(body.deviceId ?? '').trim()
  if (!deviceId || !isUuid(deviceId)) {
    return NextResponse.json({ error: 'deviceId mancante o non valido' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: devRow, error: devErr } = await service
    .from('device_sessions')
    .select('profile_id, sede_id')
    .eq('device_id', deviceId)
    .maybeSingle()

  if (devErr || !devRow) {
    return NextResponse.json({ error: 'Dispositivo non registrato' }, { status: 404 })
  }

  const { data: prof, error: pErr } = await service
    .from('profiles')
    .select('id, email, role, sede_id')
    .eq('id', (devRow as { profile_id: string }).profile_id)
    .maybeSingle()

  if (pErr || !prof) {
    return NextResponse.json({ error: 'Profilo non trovato' }, { status: 404 })
  }
  const role = String(prof.role ?? '').toLowerCase()
  if (role !== 'operatore' && role !== 'admin_sede') {
    return NextResponse.json({ error: 'Profilo non valido per operatore' }, { status: 403 })
  }

  const email = typeof prof.email === 'string' ? prof.email.trim() : ''
  if (!email) {
    return NextResponse.json({ error: 'Email profilo mancante' }, { status: 500 })
  }

  const now = new Date().toISOString()
  await service.from('device_sessions').update({ last_seen_at: now }).eq('device_id', deviceId)

  const out = NextResponse.json({ success: true as const })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            out.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const sessionRes = await createAuthSessionForEmailViaMagicOtp(supabase, email)
  if (!sessionRes.ok) {
    return NextResponse.json({ error: sessionRes.error }, { status: 501 })
  }
  return out
}
