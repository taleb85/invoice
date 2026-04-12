import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import type { Locale } from '@/lib/translations'
import { buildSollecitoBollaEmail } from '@/lib/mail-sollecito-bolla'

export async function POST() {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    // Usa anon key con RLS disabilitata per questa tabella (lettura pubblica)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Soglia: domani (modalità test – rimetti .lt e -7 per produzione)
    const soglia = new Date()
    soglia.setDate(soglia.getDate() + 1)
    const sogliaISO = soglia.toISOString().split('T')[0]

    // Bolle in attesa con data <= oggi, join con fornitori
    const { data: bolle, error: dbError } = await supabase
      .from('bolle')
      .select('id, data, fornitori(nome, email, language)')
      .eq('stato', 'in attesa')
      .lt('data', sogliaISO)
      .order('data', { ascending: true })

    if (dbError) {
      return NextResponse.json(
        { error: `Errore database: ${dbError.message}` },
        { status: 500 }
      )
    }

    if (!bolle || bolle.length === 0) {
      return NextResponse.json({
        inviati: 0,
        messaggio: 'Nessun sollecito da inviare.',
        debug: { sogliaISO },
      })
    }

    let inviati = 0
    const errori: string[] = []

    for (const bolla of bolle) {
      const raw = bolla.fornitori
      const fornitore = (Array.isArray(raw) ? raw[0] : raw) as { nome: string; email: string | null; language: string | null } | null
      const email = fornitore?.email
      const nome = fornitore?.nome ?? 'Supplier'
      const supported: Locale[] = ['it', 'en', 'es', 'fr', 'de']
      const lang = supported.includes(fornitore?.language as Locale) ? (fornitore!.language as Locale) : 'en'
      const { subject, html } = buildSollecitoBollaEmail({ nome, dataISO: bolla.data, lang })

      if (!email) continue

      const { error: mailError } = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: email,
        subject,
        html,
      })

      if (mailError) {
        errori.push(`${nome} (${email}): ${mailError.message}`)
      } else {
        inviati++
      }
    }

    return NextResponse.json({
      inviati,
      totale: bolle.length,
      ...(errori.length > 0 && { errori }),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
