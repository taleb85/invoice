import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { extractRekkiSupplierIdFromUrl } from '@/lib/rekki-extract-id'
import { lookupRekkiSuppliersByVat } from '@/lib/rekki-supplier-lookup'

type Body =
  | { action: 'lookup'; piva: string; supplierName?: string | null }
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
    const result = await lookupRekkiSuppliersByVat(body.piva ?? '', {
      supplierDisplayName: body.supplierName ?? null,
    })
    return NextResponse.json(result)
  }

  if (body.action === 'save') {
    const id = body.fornitore_id?.trim()
    const rawRid = body.rekki_supplier_id?.trim() ?? ''
    const extracted = extractRekkiSupplierIdFromUrl(rawRid)
    const rid = (extracted ?? rawRid).trim()
    if (!id || !rid) {
      return NextResponse.json({ error: 'fornitore_id e rekki_supplier_id obbligatori' }, { status: 400 })
    }
    if (
      !extracted &&
      (/^https?:\/\//i.test(rawRid) || /rekki\.(com|app)/i.test(rawRid))
    ) {
      return NextResponse.json(
        {
          error:
            'Il valore sembra un URL Rekki ma non è stato possibile estrarre l’ID. Incolla il link nel campo Link oppure solo l’ID fornitore.',
        },
        { status: 400 },
      )
    }
    const patch: { rekki_supplier_id: string; rekki_link?: string | null } = {
      rekki_supplier_id: rid,
    }
    if (body.rekki_link !== undefined) {
      patch.rekki_link = body.rekki_link === null ? null : String(body.rekki_link).trim() || null
    }
    const { data, error } = await supabase.from('fornitori').update(patch).eq('id', id).select('id')
    if (error) {
      console.error('[fornitore-rekki] Supabase update fornitori failed', {
        fornitore_id: id,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!data?.length) {
      console.error('[fornitore-rekki] Update touched 0 rows (RLS, missing row, or wrong id)', {
        fornitore_id: id,
        rekki_supplier_id: rid,
      })
      return NextResponse.json(
        {
          error:
            'Aggiornamento non applicato: nessuna riga modificata. Verifica di essere il proprietario del fornitore o che l’ID esista.',
        },
        { status: 409 },
      )
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Azione non supportata' }, { status: 400 })
}
