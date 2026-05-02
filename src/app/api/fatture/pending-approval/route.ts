import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'

export type PendingApprovalFattura = {
  id: string
  data: string | null
  importo: number | null
  numero_fattura: string | null
  file_url: string | null
  sede_id: string | null
  approval_status: string
  approval_threshold: number | null
  creato_il: string | null
  fornitoreNome: string | null
  sedeNome: string | null
}

export async function GET(req: NextRequest) {
  const profile = await getProfile()
  const isMaster = isMasterAdminRole(profile?.role)
  const isAdminSede = isSedePrivilegedRole(profile?.role)
  if (!isMaster && !isAdminSede) {
    return NextResponse.json({ error: 'Accesso negato' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const sedeIdParam = searchParams.get('sede_id')

  const service = createServiceClient()

  let q = service
    .from('fatture')
    .select(
      'id, data, importo, numero_fattura, file_url, sede_id, approval_status, approval_threshold, creato_il, fornitori(nome), sedi(nome)',
    )
    .eq('approval_status', 'pending')
    .order('importo', { ascending: false })
    .limit(100)

  // Scope: admin_sede can only see their own sede
  if (!isMaster && profile?.sede_id) {
    q = q.eq('sede_id', profile.sede_id) as typeof q
  } else if (isMaster && sedeIdParam) {
    q = q.eq('sede_id', sedeIdParam) as typeof q
  }

  const { data, error } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  type RawRow = {
    id: string
    data: string | null
    importo: number | null
    numero_fattura: string | null
    file_url: string | null
    sede_id: string | null
    approval_status: string
    approval_threshold: number | null
    creato_il: string | null
    fornitori: { nome: string | null } | null
    sedi: { nome: string | null } | null
  }

  const rows: PendingApprovalFattura[] = ((data ?? []) as unknown as RawRow[]).map((f) => ({
    id: f.id,
    data: f.data,
    importo: f.importo,
    numero_fattura: f.numero_fattura,
    file_url: f.file_url,
    sede_id: f.sede_id,
    approval_status: f.approval_status,
    approval_threshold: f.approval_threshold,
    creato_il: f.creato_il,
    fornitoreNome: f.fornitori?.nome ?? null,
    sedeNome: f.sedi?.nome ?? null,
  }))

  return NextResponse.json({ rows, count: rows.length })
}
