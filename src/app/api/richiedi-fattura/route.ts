import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { Resend } from 'resend'

function formatDate(d: string) {
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(d))
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const body = await req.json()
  const bollaIds: string[] = Array.isArray(body.bolla_ids) ? body.bolla_ids : body.bolla_id ? [body.bolla_id] : []

  if (!bollaIds.length) return NextResponse.json({ error: 'Nessuna bolla specificata' }, { status: 400 })

  const { data: bolle, error: dbError } = await supabase
    .from('bolle')
    .select('id, data, fornitori(id, nome, email)')
    .in('id', bollaIds)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  if (!bolle?.length) return NextResponse.json({ error: 'Bolle non trovate' }, { status: 404 })

  const resend = new Resend(process.env.RESEND_API_KEY)

  // Raggruppa per fornitore così inviamo una sola email per fornitore con tutte le bolle
  const byFornitore = new Map<string, { nome: string; email: string; date: string[] }>()
  for (const bolla of bolle) {
    const raw = bolla.fornitori
    const f = (Array.isArray(raw) ? raw[0] : raw) as { id: string; nome: string; email: string | null } | null
    if (!f?.email) continue
    if (!byFornitore.has(f.id)) byFornitore.set(f.id, { nome: f.nome, email: f.email, date: [] })
    byFornitore.get(f.id)!.date.push(bolla.data)
  }

  let inviati = 0
  const errori: string[] = []

  for (const { nome, email, date } of byFornitore.values()) {
    const listaDate = date
      .sort()
      .map(d => `<li>Consegna del <strong>${formatDate(d)}</strong></li>`)
      .join('')

    const { error: mailError } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: date.length === 1
        ? `Richiesta Fattura – Consegna del ${formatDate(date[0])}`
        : `Richiesta Fatture Mancanti (${date.length} consegne)`,
      html: `
        <p>Buongiorno ${nome},</p>
        <p>Siamo in attesa di ricevere le fatture relative alle seguenti consegne:</p>
        <ul>${listaDate}</ul>
        <p>Vi preghiamo di provvedere all'invio il prima possibile.</p>
        <br><p>Cordiali saluti.</p>
      `,
    })

    if (mailError) {
      errori.push(`${nome} (${email}): ${mailError.message}`)
    } else {
      inviati++
    }
  }

  return NextResponse.json({
    inviati,
    totale: byFornitore.size,
    ...(errori.length > 0 && { errori }),
  })
}
