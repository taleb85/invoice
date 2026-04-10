import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'

// ── GET /api/documenti-da-processare ──────────────────────────────────────────
// Returns pending documents using the service client to bypass RLS.
// This is necessary because documents can have sede_id = NULL (global IMAP /
// unknown sender), which is invisible via user-level RLS:  NULL ≠ sede_id.
//
// Query params:
//   stati        comma-separated stato values  (default: in_attesa,da_associare)
//   sede_id      restrict to a specific sede   (optional)
//   fornitore_id restrict to a specific supplier (optional)

export async function GET(req: NextRequest) {
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const statiParam   = searchParams.get('stati')
  const sedeId       = searchParams.get('sede_id')
  const fornitoreId  = searchParams.get('fornitore_id')

  const stati: string[] = statiParam
    ? statiParam.split(',').map(s => s.trim()).filter(Boolean)
    : ['in_attesa', 'da_associare']

  const service = createServiceClient()

  // Fetch user's profile to enforce per-sede access for non-admin operators
  const { data: profile } = await service
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  let query = service
    .from('documenti_da_processare')
    .select('*, fornitore:fornitori(nome, email)')
    .in('stato', stati)
    .order('created_at', { ascending: false })
    .limit(200)

  if (fornitoreId) {
    // Fornitore-specific filter (fornitore detail page)
    query = query.eq('fornitore_id', fornitoreId) as typeof query
  }

  if (sedeId) {
    // Explicit sede filter (sede-specific pages)
    query = query.eq('sede_id', sedeId) as typeof query
  } else if (!isAdmin && profile?.sede_id) {
    // Operators only see their sede's docs + docs with no sede (NULL)
    query = query.or(`sede_id.eq.${profile.sede_id},sede_id.is.null`) as typeof query
  }
  // Admins with no sedeId filter see everything

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  // Auth check con il client cookie-based (rispetta sessione utente)
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // Tutte le operazioni DB usano il service client per bypassare RLS:
  // evita il blocco su record con sede_id = NULL (NULL = sede_utente → NULL, non TRUE).
  const supabase = createServiceClient()

  const body = await req.json()
  const { id, azione, bolla_id, fornitore_id, is_statement } = body as {
    id: string
    azione: 'associa' | 'scarta' | 'aggiorna_fornitore' | 'mark_statement'
    bolla_id?: string
    fornitore_id?: string
    is_statement?: boolean
  }

  if (!id || !azione) return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 })

  // ── mark_statement ───────────────────────────────────────────────────────
  if (azione === 'mark_statement') {
    const { error } = await supabase
      .from('documenti_da_processare')
      .update({ is_statement: is_statement ?? true })
      .eq('id', id)
    // Tolerate error if the column doesn't exist yet (migration not applied)
    if (error && !error.message.includes('column')) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // ── aggiorna_fornitore ────────────────────────────────────────────────────
  if (azione === 'aggiorna_fornitore') {
    if (!fornitore_id) return NextResponse.json({ error: 'fornitore_id richiesto' }, { status: 400 })
    // Aggiorna anche sede_id prendendo quello del fornitore scelto
    const { data: fornitore } = await supabase
      .from('fornitori')
      .select('sede_id')
      .eq('id', fornitore_id)
      .single()
    const { error } = await supabase
      .from('documenti_da_processare')
      .update({
        fornitore_id,
        // "adotta" la sede del fornitore se il documento ne era privo
        ...(fornitore?.sede_id && { sede_id: fornitore.sede_id }),
      })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── Recupera il documento ─────────────────────────────────────────────────
  const { data: doc, error: docError } = await supabase
    .from('documenti_da_processare')
    .select('*')
    .eq('id', id)
    .single()

  if (docError || !doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
  // Allow 'in_attesa' and 'da_associare' — both mean "awaiting manual association"
  const processableStates = ['in_attesa', 'da_associare']
  if (!processableStates.includes(doc.stato)) {
    return NextResponse.json({ error: 'Documento già processato' }, { status: 400 })
  }

  // ── scarta ────────────────────────────────────────────────────────────────
  if (azione === 'scarta') {
    await supabase.from('documenti_da_processare').update({ stato: 'scartato' }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  // ── associa ───────────────────────────────────────────────────────────────
  if (azione === 'associa') {
    if (!bolla_id) return NextResponse.json({ error: 'bolla_id richiesto per associare' }, { status: 400 })

    const { data: bolla } = await supabase
      .from('bolle')
      .select('id, data, stato, fornitore_id, sede_id')
      .eq('id', bolla_id)
      .single()

    if (!bolla) return NextResponse.json({ error: 'Bolla non trovata' }, { status: 404 })
    if (bolla.stato !== 'in attesa') return NextResponse.json({ error: 'La bolla non è più in attesa' }, { status: 400 })

    const oggi = new Date().toISOString().split('T')[0]
    // sede_id definitiva: priorità bolla → documento → null
    const sedeDefinitiva = bolla.sede_id ?? doc.sede_id ?? null

    const { data: fattura, error: insertError } = await supabase
      .from('fatture')
      .insert([{
        fornitore_id: bolla.fornitore_id,
        bolla_id: bolla.id,
        sede_id: sedeDefinitiva,
        data: doc.data_documento ?? oggi,
        file_url: doc.file_url,
      }])
      .select('id')
      .single()

    if (insertError) {
      return NextResponse.json({ error: `Errore inserimento fattura: ${insertError.message}` }, { status: 500 })
    }

    // Aggiorna bolla e documento: porta il documento alla stessa sede della bolla
    // (risolve il caso "documento senza sede adottato da una bolla con sede")
    await supabase.from('bolle').update({ stato: 'completato' }).eq('id', bolla_id)
    await supabase.from('documenti_da_processare').update({
      stato: 'associato',
      bolla_id,
      fattura_id: fattura.id,
      // "adotta" fornitore e sede dalla bolla se il documento ne era privo
      ...(doc.fornitore_id == null && { fornitore_id: bolla.fornitore_id }),
      ...(doc.sede_id == null && sedeDefinitiva && { sede_id: sedeDefinitiva }),
    }).eq('id', id)

    return NextResponse.json({ ok: true, fattura_id: fattura.id })
  }

  return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
}
