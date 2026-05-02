import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'

export interface Contatto {
  id: string
  fornitore_id: string
  nome: string
  ruolo: string | null
  email: string | null
  telefono: string | null
  created_at: string
}

// GET /api/fornitore-contatti?fornitore_id=xxx
export async function GET(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const fornitoreId = new URL(req.url).searchParams.get('fornitore_id')
  if (!fornitoreId) return NextResponse.json({ error: 'fornitore_id richiesto' }, { status: 400 })

  const { data, error } = await service
    .from('fornitore_contatti')
    .select('*')
    .eq('fornitore_id', fornitoreId)
    .order('created_at')

  if (error) {
    // Table may not exist yet — return empty array gracefully
    if (error.message.includes('fornitore_contatti') || error.code === '42P01') {
      return NextResponse.json([])
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// POST /api/fornitore-contatti
export async function POST(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const body = await req.json() as { fornitore_id: string; nome: string; ruolo?: string; email?: string; telefono?: string }
  if (!body.fornitore_id || !body.nome?.trim()) {
    return NextResponse.json({ error: 'fornitore_id e nome sono obbligatori' }, { status: 400 })
  }

  const { data, error } = await service
    .from('fornitore_contatti')
    .insert([{
      fornitore_id: body.fornitore_id,
      nome: body.nome.trim(),
      ruolo: body.ruolo?.trim() || null,
      email: body.email?.trim() || null,
      telefono: body.telefono?.trim() || null,
    }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH /api/fornitore-contatti?id=xxx
export async function PATCH(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })

  const body = await req.json() as { nome?: string; ruolo?: string; email?: string; telefono?: string }
  const { data, error } = await service
    .from('fornitore_contatti')
    .update({
      ...(body.nome     !== undefined && { nome: body.nome.trim() }),
      ...(body.ruolo    !== undefined && { ruolo: body.ruolo.trim() || null }),
      ...(body.email    !== undefined && { email: body.email.trim() || null }),
      ...(body.telefono !== undefined && { telefono: body.telefono.trim() || null }),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/fornitore-contatti?id=xxx
export async function DELETE(req: NextRequest) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })

  const { error } = await service.from('fornitore_contatti').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
