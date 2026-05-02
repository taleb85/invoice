import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { checkPriceAnomalies } from '@/lib/price-anomaly-checker'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'

export async function POST(req: NextRequest) {
  // Accept either a valid admin/admin_sede session OR the CRON_SECRET bearer token
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const hasCronSecret = !!cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!hasCronSecret) {
    const profile = await getProfile()
    if (!isMasterAdminRole(profile?.role) && !isSedePrivilegedRole(profile?.role)) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
    }
  }

  const body = (await req.json().catch(() => ({}))) as {
    fattura_id?: string
    fornitore_id?: string
    threshold?: number
  }
  const { fattura_id, fornitore_id, threshold = 0.05 } = body

  if (!fattura_id || !fornitore_id) {
    return NextResponse.json(
      { error: 'fattura_id e fornitore_id richiesti' },
      { status: 400 },
    )
  }

  const supabase = createServiceClient()

  // Get sede_id from the fattura so we can store it on each anomaly row
  const { data: fatturaRow } = await supabase
    .from('fatture')
    .select('sede_id')
    .eq('id', fattura_id)
    .single()
  const sedeId = (fatturaRow as { sede_id?: string | null } | null)?.sede_id ?? null

  const anomalies = await checkPriceAnomalies(supabase, fattura_id, fornitore_id, threshold)

  if (anomalies.length > 0) {
    await supabase.from('price_anomalies').upsert(
      anomalies.map((a) => ({
        fattura_id: a.fatturaId,
        fornitore_id: a.fornitoreId,
        sede_id: sedeId,
        prodotto: a.prodotto,
        prezzo_pagato: a.prezzoPagato,
        prezzo_listino: a.prezzoListino,
        differenza_percent: a.differenzaPercent,
        resolved: false,
      })),
      { onConflict: 'fattura_id,prodotto' },
    )
  }

  return NextResponse.json({ anomalies, count: anomalies.length })
}
