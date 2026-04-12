import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'

const ALLOWED_COUNTRIES = ['UK', 'IT', 'FR', 'DE', 'ES']
const ALLOWED_CURRENCIES = ['GBP', 'EUR', 'USD', 'CHF', 'CAD', 'AUD', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF']
const ALLOWED_LANGS = ['it', 'en', 'fr', 'de', 'es']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json() as {
    country_code?: string
    currency?: string
    timezone?: string
  }

  const update: Record<string, string> = {}

  if (body.country_code !== undefined) {
    if (!ALLOWED_COUNTRIES.includes(body.country_code)) {
      return NextResponse.json({ error: 'Invalid country code' }, { status: 400 })
    }
    update.country_code = body.country_code
  }

  if (body.currency !== undefined) {
    if (!ALLOWED_CURRENCIES.includes(body.currency)) {
      return NextResponse.json({ error: 'Invalid currency code' }, { status: 400 })
    }
    update.currency = body.currency
  }

  if (body.timezone !== undefined) {
    // Basic IANA tz validation — trust the client list, but sanitise format
    if (!/^[A-Za-z_]+\/[A-Za-z_]+/.test(body.timezone)) {
      return NextResponse.json({ error: 'Invalid timezone' }, { status: 400 })
    }
    update.timezone = body.timezone
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('sedi')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, ...update })
}

/** PATCH /api/sedi/[id]/fornitore-lang — sets language preference on a supplier */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { language?: string | null }
  const lang = body.language ?? null

  if (lang !== null && !ALLOWED_LANGS.includes(lang)) {
    return NextResponse.json({ error: 'Invalid language code' }, { status: 400 })
  }

  const service = createServiceClient()
  const { error } = await service
    .from('fornitori')
    .update({ language: lang })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, language: lang })
}
