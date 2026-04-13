import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { lookupRekkiSuppliersByVat } from '@/lib/rekki-supplier-lookup'

type Body =
  | { action: 'lookup'; piva: string }
  | {
      action: 'save'
      fornitore_id: string
      rekki_supplier_id: string
      rekki_link?: string | null
    }

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }

  if (body.action === 'lookup') {
    const result = await lookupRekkiSuppliersByVat(body.piva ?? '')
    return NextResponse.json(result)
  }

  if (body.action === 'save') {
    const id = body.fornitore_id?.trim()
    const rid = body.rekki_supplier_id?.trim()
    if (!id || !rid) {
      return NextResponse.json({ error: 'fornitore_id e rekki_supplier_id obbligatori' }, { status: 400 })
    }
    const patch: { rekki_supplier_id: string; rekki_link?: string | null } = {
      rekki_supplier_id: rid,
    }
    if (body.rekki_link !== undefined) {
      patch.rekki_link = body.rekki_link === null ? null : String(body.rekki_link).trim() || null
    }
    const { error } = await supabase.from('fornitori').update(patch).eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Azione non supportata' }, { status: 400 })
}
