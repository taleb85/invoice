import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { isSedePrivilegedRole, isMasterAdminRole } from '@/lib/roles'
import {
  OCR_SCARTO_RULE_TIPOS,
  parseOcrScartoRuleTipo,
  type OcrScartoRuleRow,
} from '@/lib/ocr-scarto-rules'

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
  const sedeAdmin = isSedePrivilegedRole(profile?.role)
  if (!master && !sedeAdmin) return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })

  const sedeParam = req.nextUrl.searchParams.get('sede_id')?.trim() || ''
  const includeInactive = req.nextUrl.searchParams.get('include_inactive') === '1'
  const sedeId = sedeParam || profile?.sede_id || ''
  if (!sedeId) return NextResponse.json({ error: 'sede richiesta' }, { status: 400 })
  if (!master && sedeParam && sedeParam !== profile?.sede_id) {
    return NextResponse.json({ error: 'Puoi leggere solo la tua sede' }, { status: 403 })
  }

  const service = createServiceClient()
  let q = service
    .from('ocr_scarto_rules')
    .select('id, sede_id, tipo, valore, motivo, attivo, creato_da, created_at')
    .eq('sede_id', sedeId)
    .order('created_at', { ascending: false })
  if (!includeInactive) {
    q = q.eq('attivo', true) as typeof q
  }

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: (data ?? []) as OcrScartoRuleRow[] })
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = (await req.json()) as {
    sede_id?: string
    tipo?: string
    valore?: string
    motivo?: string | null
    attivo?: boolean
  }
  const tipo = parseOcrScartoRuleTipo(body.tipo)
  if (!tipo) {
    return NextResponse.json({ error: `tipo non valido (${OCR_SCARTO_RULE_TIPOS.join(', ')})` }, { status: 400 })
  }
  const valore = typeof body.valore === 'string' ? body.valore.trim() : ''
  if (!valore) {
    return NextResponse.json({ error: 'valore obbligatorio' }, { status: 400 })
  }

  const { data: profile } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()
  const master = isMasterAdminRole(profile?.role)
  const sedeAdmin = isSedePrivilegedRole(profile?.role)
  if (!master && !sedeAdmin) return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })

  const sede_id = targetSedeId(profile as { role?: string | null; sede_id?: string | null }, body.sede_id)
  if (!sede_id) return NextResponse.json({ error: 'Sede richiesta sul profilo' }, { status: 400 })
  if (sedeAdmin && profile?.sede_id !== sede_id) {
    return NextResponse.json({ error: 'Puoi modificare solo la tua sede' }, { status: 403 })
  }

  const service = createServiceClient()
  const motivo =
    typeof body.motivo === 'string' && body.motivo.trim() ? body.motivo.trim().slice(0, 800) : null
  const attivo = typeof body.attivo === 'boolean' ? body.attivo : true

  const { data: row, error } = await service
    .from('ocr_scarto_rules')
    .insert([
      {
        sede_id,
        tipo,
        valore,
        motivo,
        attivo,
        creato_da: user.id,
      },
    ])
    .select('id, sede_id, tipo, valore, motivo, attivo, creato_da, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: row as OcrScartoRuleRow })
}

// ── PATCH (toggle attivo) ─────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = (await req.json()) as { id?: string; sede_id?: string; attivo?: boolean }
  const id = body.id?.trim()
  if (!id) return NextResponse.json({ error: 'id obbligatorio' }, { status: 400 })
  if (typeof body.attivo !== 'boolean') return NextResponse.json({ error: 'attivo richiesto' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()
  const master = isMasterAdminRole(profile?.role)
  const sedeAdmin = isSedePrivilegedRole(profile?.role)
  if (!master && !sedeAdmin) return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })

  const service = createServiceClient()
  const { data: existing, error: exErr } = await service
    .from('ocr_scarto_rules')
    .select('id, sede_id')
    .eq('id', id)
    .maybeSingle()
  if (exErr || !existing) return NextResponse.json({ error: 'Regola non trovata' }, { status: 404 })

  if (sedeAdmin && existing.sede_id !== profile?.sede_id) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const { data: row, error } = await service
    .from('ocr_scarto_rules')
    .update({ attivo: body.attivo })
    .eq('id', id)
    .select('id, sede_id, tipo, valore, motivo, attivo, creato_da, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: row as OcrScartoRuleRow })
}

// ── DELETE ────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const url = req.nextUrl
  const id = url.searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ error: 'id obbligatorio' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()
  const master = isMasterAdminRole(profile?.role)
  const sedeAdmin = isSedePrivilegedRole(profile?.role)
  if (!master && !sedeAdmin) return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })

  const service = createServiceClient()
  const { data: existing } = await service.from('ocr_scarto_rules').select('id, sede_id').eq('id', id).maybeSingle()
  if (!existing) return NextResponse.json({ ok: true })
  if (sedeAdmin && existing.sede_id !== profile?.sede_id) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const { error } = await service.from('ocr_scarto_rules').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
