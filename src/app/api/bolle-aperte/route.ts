import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'

/**
 * GET /api/bolle-aperte[?sede_id=xxx][&fornitore_id=yyy]
 *
 * Restituisce tutte le bolle con stato "in attesa" visibili all'utente.
 * Usa createServiceClient() per bypassare RLS (che blocca i record con sede_id = NULL)
 * e applica il filtro sede in application-code.
 *
 * ?sede_id=xxx      → forza il filtro a una sede specifica (pagine sede-centric).
 * ?fornitore_id=yyy → restringe alle bolle di un fornitore specifico.
 * Admin Master (senza ?sede_id) → vede tutte le sedi.
 * Operatore → vede solo le bolle della propria sede (o quelle senza sede per retrocomp.).
 */
export async function GET(req: NextRequest) {
  // 1. Verifica sessione
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // 2. Query params
  const { searchParams } = new URL(req.url)
  const overrideSedeId  = searchParams.get('sede_id') ?? null
  const fornitoreId     = searchParams.get('fornitore_id') ?? null

  // 3. Profilo (sede_id + role) — via createClient così RLS si applica correttamente al profilo
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('sede_id, role')
    .eq('id', user.id)
    .single()

  const isMasterAdmin = profile?.role === 'admin'
  const isAdminSede = profile?.role === 'admin_sede'
  const profileSedeId = profile?.sede_id ?? null

  if (isAdminSede && overrideSedeId && profileSedeId && overrideSedeId !== profileSedeId) {
    return NextResponse.json({ error: 'sede_id non consentito' }, { status: 403 })
  }

  // Effective sede: explicit override wins, otherwise use profile sede
  const effectiveSedeId = overrideSedeId ?? profileSedeId

  if (profileErr) console.error(`[bolle-aperte] Errore profilo: ${profileErr.message}`)

  // 4. Service client per bypassare RLS sulle bolle
  const service = createServiceClient()

  const baseQuery = service
    .from('bolle')
    .select('id, data, importo, numero_bolla, fornitore_id, fornitori(nome)')
    .eq('stato', 'in attesa')
    .order('data', { ascending: true })

  let query = baseQuery

  if (fornitoreId) {
    // Fornitore-specific filter (fornitore detail page — Statements tab)
    query = query.eq('fornitore_id', fornitoreId) as typeof query
  }

  if (overrideSedeId) {
    // Explicit sede filter from URL param (sede-centric pages)
    query = query.eq('sede_id', overrideSedeId) as typeof query
  } else if (!isMasterAdmin) {
    if (effectiveSedeId) {
      // Operatore con sede: vede le bolle della sua sede + quelle senza sede (retrocompatibilità)
      query = query.or(`sede_id.eq.${effectiveSedeId},sede_id.is.null`) as typeof query
    } else {
      // Operatore senza sede assegnata: mostra tutto (fail-open, evita blocco totale)
      console.warn(`[bolle-aperte] Utente ${user.id} non ha sede_id nel profilo — restituisco tutto`)
    }
  }
  // Admin Master (senza override): nessun filtro aggiuntivo → vede tutto

  const { data, error } = await query

  if (error) console.error(`[bolle-aperte] Errore query: ${error.message}`)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
