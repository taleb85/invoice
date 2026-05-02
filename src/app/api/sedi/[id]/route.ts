import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/utils/supabase/server'
import { isSedePrivilegedRole, isMasterAdminRole, isAdminTecnicoRole } from '@/lib/roles'
import { DEFAULT_NOMI_CLIENTE_DA_IGNORARE } from '@/lib/ocr-invoice'

const ALLOWED_COUNTRIES = ['UK', 'IT', 'FR', 'DE', 'ES']
const ALLOWED_CURRENCIES = ['GBP', 'EUR', 'USD', 'CHF', 'CAD', 'AUD', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF']
const ALLOWED_LANGS = ['it', 'en', 'fr', 'de', 'es']

/** Nome sede + elenco «nomi cliente da ignorare» (merge default se vuoto nel DB). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role, sede_id').eq('id', user.id).single()

  const master = isMasterAdminRole(profile?.role)
  const sedeAdmin = isSedePrivilegedRole(profile?.role)
  if (!master && !sedeAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (sedeAdmin && profile?.sede_id !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  const { data: sede, error } = await service
    .from('sedi')
    .select('id, nome, nomi_cliente_da_ignorare')
    .eq('id', id)
    .maybeSingle()

  if (error || !sede) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const rawIgnored = (sede as { nomi_cliente_da_ignorare?: string[] | null }).nomi_cliente_da_ignorare
  const merged =
    Array.isArray(rawIgnored) && rawIgnored.length > 0
      ? rawIgnored.filter((x): x is string => typeof x === 'string' && !!x.trim())
      : [...DEFAULT_NOMI_CLIENTE_DA_IGNORARE]

  return NextResponse.json({
    id: sede.id,
    nome: sede.nome,
    nomi_cliente_da_ignorare: merged,
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .single()

  const master = isMasterAdminRole(profile?.role)
  const sedeAdmin = isSedePrivilegedRole(profile?.role)
  if (!master && !sedeAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  if (sedeAdmin && profile?.sede_id !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as {
    country_code?: string
    currency?: string
    timezone?: string
    nome?: string
    access_password?: string | null
    imap_host?: string | null
    imap_port?: number | null
    imap_user?: string | null
    imap_password?: string | null
    imap_lookback_days?: number | null
    /** Nomi cliente/destinatario da non usare come fornitore in OCR (merge con default in app). */
    nomi_cliente_da_ignorare?: string[] | null
  }

  const update: Record<string, string | number | string[] | null> = {}

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

  if (body.nome !== undefined) {
    const nome = typeof body.nome === 'string' ? body.nome.trim() : ''
    if (!nome) return NextResponse.json({ error: 'Nome sede obbligatorio.' }, { status: 400 })
    update.nome = nome
  }

  if (body.access_password !== undefined) {
    if (body.access_password === null || body.access_password === '') {
      update.access_password = null
    } else {
      const digits = String(body.access_password).replace(/\D/g, '').slice(0, 4)
      if (digits.length !== 4) {
        return NextResponse.json({ error: 'PIN accesso sede: 4 cifre o vuoto.' }, { status: 400 })
      }
      update.access_password = digits
    }
  }

  if (body.imap_host !== undefined) {
    update.imap_host = body.imap_host && String(body.imap_host).trim() ? String(body.imap_host).trim() : null
  }
  if (body.imap_port !== undefined) {
    update.imap_port =
      body.imap_port == null || body.imap_port === 0 ? null : Number(body.imap_port) || 993
  }
  if (body.imap_user !== undefined) {
    update.imap_user = body.imap_user && String(body.imap_user).trim() ? String(body.imap_user).trim() : null
  }
  if (body.imap_password !== undefined) {
    update.imap_password =
      body.imap_password === null || body.imap_password === ''
        ? null
        : String(body.imap_password)
  }
  if (body.imap_lookback_days !== undefined) {
    const n = Number(body.imap_lookback_days)
    update.imap_lookback_days =
      body.imap_lookback_days == null || Number.isNaN(n) || n <= 0 ? null : n
  }

  if (body.nomi_cliente_da_ignorare !== undefined) {
    if (body.nomi_cliente_da_ignorare === null) {
      update.nomi_cliente_da_ignorare = null
    } else if (Array.isArray(body.nomi_cliente_da_ignorare)) {
      const names = body.nomi_cliente_da_ignorare
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
      update.nomi_cliente_da_ignorare = names
    } else {
      return NextResponse.json({ error: 'Invalid nomi_cliente_da_ignorare' }, { status: 400 })
    }
  }

  if (isAdminTecnicoRole(profile?.role)) {
    const reserved = ['nome', 'country_code', 'currency', 'timezone', 'access_password', 'nomi_cliente_da_ignorare'] as const
    for (const k of reserved) {
      if (k in update) {
        return NextResponse.json(
          { error: 'Questo campo è riservato al responsabile di sede o all’admin principale.' },
          { status: 403 },
        )
      }
    }
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
