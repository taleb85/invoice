import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { isAdminSedeRole, isMasterAdminRole } from '@/lib/roles'
import {
  normalizeBlacklistMittente,
  parseEmailBlacklistMotivo,
  EMAIL_BLACKLIST_MOTIVI,
} from '@/lib/email-scan-blacklist'

function targetSedeId(profile: { role?: string | null; sede_id?: string | null }, bodySede?: string): string | null {
  const master = isMasterAdminRole(profile?.role)
  if (master && bodySede?.trim()) return bodySede.trim()
  return profile?.sede_id ?? null
}

// ── GET ───────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()
  const master = isMasterAdminRole(profile?.role)
  const sedeAdmin = isAdminSedeRole(profile?.role)
  if (!master && !sedeAdmin) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const motivoFilter = req.nextUrl.searchParams.get('motivo')
  let sedeParam = req.nextUrl.searchParams.get('sede_id')

  let sedeId = sedeParam?.trim() || profile?.sede_id || null
  if (!master && sedeParam && sedeParam !== profile?.sede_id) {
    return NextResponse.json({ error: 'Puoi leggere solo la blacklist della tua sede' }, { status: 403 })
  }
  if (!sedeId) {
    return NextResponse.json({ error: 'sede non disponibile sul profilo' }, { status: 400 })
  }

  const parsedMotivo =
    typeof motivoFilter === 'string' && motivoFilter.trim()
      ? parseEmailBlacklistMotivo(motivoFilter.trim())
      : null
  if (motivoFilter && motivoFilter.trim() && parsedMotivo === null) {
    return NextResponse.json(
      { error: `motivo non valido (attesi: ${EMAIL_BLACKLIST_MOTIVI.join(', ')})` },
      { status: 400 },
    )
  }

  const service = createServiceClient()
  let q = service
    .from('email_scan_blacklist')
    .select('id, sede_id, mittente, motivo, aggiunto_da, created_at')
    .eq('sede_id', sedeId)
    .order('created_at', { ascending: false })

  if (parsedMotivo) {
    q = q.eq('motivo', parsedMotivo) as typeof q
  }

  const { data, error } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = (await req.json()) as { mittente?: string; motivo?: string; sede_id?: string }
  const rawMitt = body.mittente?.trim()
  if (!rawMitt) {
    return NextResponse.json({ error: 'mittente obbligatorio' }, { status: 400 })
  }

  const motivoParsed = parseEmailBlacklistMotivo(body.motivo)
  if (!motivoParsed) {
    return NextResponse.json(
      { error: `motivo obbligatorio o non valido (${EMAIL_BLACKLIST_MOTIVI.join(', ')})` },
      { status: 400 },
    )
  }

  const { data: profile } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()
  const master = isMasterAdminRole(profile?.role)
  const sedeAdmin = isAdminSedeRole(profile?.role)
  if (!master && !sedeAdmin) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const sede_id = targetSedeId(profile as { role?: string | null; sede_id?: string | null }, body.sede_id)
  if (!sede_id) {
    return NextResponse.json({ error: 'Sede richiesta sul profilo' }, { status: 400 })
  }
  if (sedeAdmin && profile?.sede_id !== sede_id) {
    return NextResponse.json({ error: 'Puoi modificare solo la blacklist della tua sede' }, { status: 403 })
  }

  const mittente = normalizeBlacklistMittente(rawMitt)
  if (!mittente) {
    return NextResponse.json({ error: 'mittente non valido' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data: row, error } = await service
    .from('email_scan_blacklist')
    .upsert(
      {
        sede_id,
        mittente,
        motivo: motivoParsed as string,
        aggiunto_da: user.id,
      },
      { onConflict: 'sede_id,mittente' },
    )
    .select('id, sede_id, mittente, motivo, aggiunto_da, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ row }, { status: 201 })
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const mittente = req.nextUrl.searchParams.get('mittente')?.trim()
  if (!mittente) {
    return NextResponse.json({ error: 'mittente mancante' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()
  const master = isMasterAdminRole(profile?.role)
  const sedeAdmin = isAdminSedeRole(profile?.role)
  if (!master && !sedeAdmin) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const sedeParam = req.nextUrl.searchParams.get('sede_id')?.trim()
  let sedeId = sedeParam || profile?.sede_id || null
  if (!sedeId) return NextResponse.json({ error: 'sede richiesta' }, { status: 400 })
  if (!master && sedeParam && sedeParam !== profile?.sede_id) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }
  if (sedeAdmin && profile?.sede_id !== sedeId) {
    return NextResponse.json({ error: 'Puoi modificare solo la blacklist della tua sede' }, { status: 403 })
  }

  const key = normalizeBlacklistMittente(mittente)

  const service = createServiceClient()
  const { error } = await service.from('email_scan_blacklist').delete().eq('sede_id', sedeId).eq('mittente', key)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
