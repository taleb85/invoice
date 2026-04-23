import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isAdminSedeRole } from '@/lib/roles'
import { utcBoundsForZonedCalendarDay } from '@/lib/zoned-day-bounds'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export type ScannerDetailRow = {
  id: string
  created_at: string
  tipo: 'ai_elaborata' | 'bolla' | 'fattura'
  numero: string | null
  fornitore_nome: string | null
  /** YYYY-MM-DD document date (for bolle/fatture) */
  data: string | null
  file_nome: string | null
  stato: string | null
}

function fileNomeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const decoded = decodeURIComponent(url.split('?')[0] ?? url)
    const parts = decoded.split('/').filter(Boolean)
    const last = parts[parts.length - 1]
    return last && last.length <= 120 ? last : (decoded.length > 72 ? `${decoded.slice(0, 72)}…` : decoded)
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const profile = await getProfile()
  const isMaster = isMasterAdminRole(profile?.role)
  const isAdminSede = isAdminSedeRole(profile?.role)
  const isOperatore = profile?.role === 'operatore'

  if (!isMaster && !isAdminSede && !isOperatore) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as 'elaborate' | 'archiviate' | null
  const tzParam = searchParams.get('tz') ?? 'UTC'

  if (type !== 'elaborate' && type !== 'archiviate') {
    return NextResponse.json({ error: 'type deve essere elaborate o archiviate' }, { status: 400 })
  }

  let sedeId = profile?.sede_id ?? null
  if (isMaster && !sedeId) {
    const cookieStore = await cookies()
    const adminPick = cookieStore.get('admin-sede-id')?.value?.trim() || null
    if (adminPick) sedeId = adminPick
  }
  if (!sedeId) {
    return NextResponse.json({ error: 'Sede non selezionata' }, { status: 400 })
  }

  const { start, endExclusive } = utcBoundsForZonedCalendarDay(tzParam)
  const svc = createServiceClient()
  const rows: ScannerDetailRow[] = []

  if (type === 'elaborate') {
    const { data, error } = await svc
      .from('scanner_flow_events')
      .select('id, created_at, step')
      .eq('sede_id', sedeId)
      .eq('step', 'ai_elaborata')
      .gte('created_at', start)
      .lt('created_at', endExclusive)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      for (const row of data) {
        rows.push({
          id: row.id as string,
          created_at: row.created_at as string,
          tipo: 'ai_elaborata',
          numero: null,
          fornitore_nome: null,
          data: null,
          file_nome: null,
          stato: null,
        })
      }
    }
  } else {
    // archiviate: today's bolle + fatture for this sede
    type BollaRaw = {
      id: string
      created_at: string
      data: string | null
      numero_bolla: string | null
      file_url: string | null
      stato: string | null
      fornitori: { nome: string | null } | null
    }
    type FatturaRaw = {
      id: string
      created_at: string
      data: string | null
      numero_fattura: string | null
      file_url: string | null
      fornitori: { nome: string | null } | null
    }

    const [bolleRes, fattureRes] = await Promise.all([
      svc
        .from('bolle')
        .select('id, created_at, data, numero_bolla, file_url, stato, fornitori(nome)')
        .eq('sede_id', sedeId)
        .gte('created_at', start)
        .lt('created_at', endExclusive)
        .order('created_at', { ascending: false })
        .limit(30),
      svc
        .from('fatture')
        .select('id, created_at, data, numero_fattura, file_url, fornitori(nome)')
        .eq('sede_id', sedeId)
        .gte('created_at', start)
        .lt('created_at', endExclusive)
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    if (!bolleRes.error && bolleRes.data) {
      for (const b of bolleRes.data as unknown as BollaRaw[]) {
        rows.push({
          id: b.id,
          created_at: b.created_at,
          tipo: 'bolla',
          numero: b.numero_bolla ?? null,
          fornitore_nome: b.fornitori?.nome ?? null,
          data: b.data ?? null,
          file_nome: fileNomeFromUrl(b.file_url),
          stato: b.stato ?? null,
        })
      }
    }
    if (!fattureRes.error && fattureRes.data) {
      for (const f of fattureRes.data as unknown as FatturaRaw[]) {
        rows.push({
          id: f.id,
          created_at: f.created_at,
          tipo: 'fattura',
          numero: f.numero_fattura ?? null,
          fornitore_nome: f.fornitori?.nome ?? null,
          data: f.data ?? null,
          file_nome: fileNomeFromUrl(f.file_url),
          stato: null,
        })
      }
    }

    // Merge & sort by created_at desc
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  return NextResponse.json({ ok: true, rows, total: rows.length })
}
