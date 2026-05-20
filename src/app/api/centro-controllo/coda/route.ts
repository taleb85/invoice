import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getRequestAuth()
    if (!user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const { searchParams } = new URL(request.url)
    const sedeId = searchParams.get('sede_id')
    const origine = searchParams.get('origine')
    const prioritaMax = searchParams.get('priorita_max')

    let query = supabase.from('v_coda_unificata').select('*').order('priorita', { ascending: true }).order('data_inserimento', { ascending: false })

    if (sedeId) query = query.eq('sede_id', sedeId)
    if (origine) query = query.eq('origine', origine)
    if (prioritaMax) query = query.lte('priorita', parseInt(prioritaMax))

    const { data: items, error } = await query.limit(500)

    if (error) {
      console.error('[CentroControllo] Errore query v_coda_unificata:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const filtered = items ?? []

    const conteggi = {
      documenti_da_processare: filtered.filter((i) => i.origine === 'documento_da_processare').length || 0,
      fatture_pending: filtered.filter((i) => i.origine === 'fattura').length || 0,
      errori_sincronizzazione: filtered.filter((i) => i.origine === 'errore_sincronizzazione').length || 0,
      bolle_aperte: filtered.filter((i) => i.origine === 'bolla_aperta').length || 0,
      righe_statement: filtered.filter((i) => i.origine === 'riga_statement').length || 0,
      totale: filtered.length || 0,
    }

    return NextResponse.json({ items: filtered, conteggi })
  } catch (e) {
    console.error('[CentroControllo] Errore generico:', e)
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }
}
