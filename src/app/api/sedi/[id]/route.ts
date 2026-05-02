import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { isBranchSedeStaffRole, isMasterAdminRole } from '@/lib/roles'
import { DEFAULT_NOMI_CLIENTE_DA_IGNORARE } from '@/lib/ocr-invoice'
import type { SedeFileRetentionPolicy } from '@/types'

const ALLOWED_COUNTRIES = ['UK', 'IT', 'FR', 'DE', 'ES']
const ALLOWED_CURRENCIES = ['GBP', 'EUR', 'USD', 'CHF', 'CAD', 'AUD', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF']
const ALLOWED_LANGS = ['it', 'en', 'fr', 'de', 'es']

/** Nome sede + elenco «nomi cliente da ignorare» (merge default se vuoto nel DB). */
export async function GET(
  _req: NextRequest,
  segmentCtx: { params: Promise<{ id: string }> },
) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile, error: profileErr } = await service
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr) {
    console.error('[GET /api/sedi/[id]] profiles', profileErr.message)
    return NextResponse.json({ error: 'Profilo non disponibile' }, { status: 500 })
  }
  if (!profile) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: rawId } = await segmentCtx.params
  const id = String(rawId ?? '').trim()
  if (!id) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const profileSedeId =
    typeof profile.sede_id === 'string' && profile.sede_id.trim() !== '' ? profile.sede_id.trim() : null

  const master = isMasterAdminRole(profile.role)
  const branchStaff = isBranchSedeStaffRole(profile.role)
  if (!master && !branchStaff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let staffSede = profileSedeId
  if (branchStaff && !staffSede) {
    const jar = await cookies()
    staffSede = jar.get('admin-sede-id')?.value?.trim() || null
  }
  if (branchStaff && staffSede !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: sede, error: sedeErr } = await service
    .from('sedi')
    .select('id, nome, nomi_cliente_da_ignorare')
    .eq('id', id)
    .maybeSingle()

  if (sedeErr) {
    console.error('[GET /api/sedi/[id]] sedi', sedeErr.message)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!sede) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
  segmentCtx: { params: Promise<{ id: string }> },
) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClient()
  const { data: profile, error: profileErr } = await service
    .from('profiles')
    .select('role, sede_id')
    .eq('id', user.id)
    .maybeSingle()

  if (profileErr) {
    console.error('[PATCH /api/sedi/[id]] profiles', profileErr.message)
    return NextResponse.json({ error: 'Profilo non disponibile' }, { status: 500 })
  }
  if (!profile) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id: rawId } = await segmentCtx.params
  const id = String(rawId ?? '').trim()
  if (!id) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const profileSedeId =
    typeof profile.sede_id === 'string' && profile.sede_id.trim() !== '' ? profile.sede_id.trim() : null

  const master = isMasterAdminRole(profile.role)
  const branchStaff = isBranchSedeStaffRole(profile.role)
  if (!master && !branchStaff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let staffSede = profileSedeId
  if (branchStaff && !staffSede) {
    const jar = await cookies()
    staffSede = jar.get('admin-sede-id')?.value?.trim() || null
  }
  if (branchStaff && staffSede !== id) {
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
    file_retention_policy?: SedeFileRetentionPolicy
    file_retention_months?: number | null
    file_retention_days?: number | null
    file_retention_run_day?: number | null
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

  if (body.file_retention_policy !== undefined) {
    const pol = body.file_retention_policy
    if (pol !== 'keep' && pol !== 'delete_only' && pol !== 'archive_then_delete') {
      return NextResponse.json({ error: 'Invalid file_retention_policy' }, { status: 400 })
    }
    update.file_retention_policy = pol
  }

  if (body.file_retention_months !== undefined) {
    const n = Number(body.file_retention_months)
    if (body.file_retention_months == null || Number.isNaN(n)) {
      update.file_retention_months = null
    } else {
      update.file_retention_months = Math.min(120, Math.max(1, Math.floor(n)))
    }
  }

  if (body.file_retention_days !== undefined) {
    if (body.file_retention_days == null) {
      return NextResponse.json({ error: 'file_retention_days obbligatorio' }, { status: 400 })
    }
    const n = Number(body.file_retention_days)
    if (Number.isNaN(n)) {
      return NextResponse.json({ error: 'Invalid file_retention_days' }, { status: 400 })
    }
    update.file_retention_days = Math.min(3650, Math.max(1, Math.floor(n)))
  }

  if (body.file_retention_run_day !== undefined) {
    const d = Number(body.file_retention_run_day)
    if (body.file_retention_run_day == null || Number.isNaN(d)) {
      update.file_retention_run_day = null
    } else {
      update.file_retention_run_day = Math.min(28, Math.max(1, Math.floor(d)))
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

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
  segmentCtx: { params: Promise<{ id: string }> },
) {
  const { user } = await getRequestAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await segmentCtx.params
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
