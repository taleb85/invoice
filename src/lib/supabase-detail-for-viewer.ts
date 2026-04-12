/**
 * Caricamento bolle/fatture nelle Server Components con lo stesso criterio di
 * visibilità di open-document: admin via service role; operatore prima RLS, poi
 * verifica sede/fornitore se la riga non torna dal client anonimo.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient, createServiceClient, getProfile } from '@/utils/supabase/server'

const FATTURA_SELECT = '*, fornitore:fornitori(nome, email, piva), bolla:bolle(id, data, stato)'
const BOLLA_SELECT = '*, fornitore:fornitori(nome, email, piva)'

function isAdminProfile(profile: { role?: string } | null): boolean {
  return String(profile?.role ?? '').toLowerCase() === 'admin'
}

async function fornitoreSedeMatches(
  service: SupabaseClient,
  fornitoreId: string | null,
  sedeId: string
): Promise<boolean> {
  if (!fornitoreId) return false
  const { data } = await service.from('fornitori').select('sede_id').eq('id', fornitoreId).maybeSingle()
  return data?.sede_id === sedeId
}

async function operatoreCanAccessFattura(
  service: SupabaseClient,
  row: { sede_id: string | null; fornitore_id: string | null },
  userSedeId: string | null
): Promise<boolean> {
  if (!userSedeId) return false
  if (row.sede_id === userSedeId) return true
  if (row.sede_id === null) return true
  return fornitoreSedeMatches(service, row.fornitore_id, userSedeId)
}

async function operatoreCanAccessBolla(
  service: SupabaseClient,
  row: { sede_id: string | null; fornitore_id: string | null },
  userSedeId: string | null
): Promise<boolean> {
  if (!userSedeId) return false
  if (row.sede_id === userSedeId) return true
  if (row.sede_id === null) return true
  return fornitoreSedeMatches(service, row.fornitore_id, userSedeId)
}

export async function getFatturaForViewer(id: string) {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) return null

  const profile = await getProfile()
  if (!profile) return null

  const isAdmin = isAdminProfile(profile)
  const service = createServiceClient()

  if (isAdmin) {
    const { data: viaService } = await service.from('fatture').select(FATTURA_SELECT).eq('id', id).maybeSingle()
    if (viaService) return viaService
    // Service role assente/errato in .env locale: RLS consente comunque SELECT agli admin.
    const { data: viaAuth } = await auth.from('fatture').select(FATTURA_SELECT).eq('id', id).maybeSingle()
    return viaAuth
  }

  const { data: viaUser } = await auth.from('fatture').select(FATTURA_SELECT).eq('id', id).maybeSingle()
  if (viaUser) return viaUser

  const { data: row } = await service
    .from('fatture')
    .select('sede_id, fornitore_id')
    .eq('id', id)
    .maybeSingle()
  if (!row) return null
  if (!(await operatoreCanAccessFattura(service, row, profile.sede_id))) return null

  const { data } = await service.from('fatture').select(FATTURA_SELECT).eq('id', id).maybeSingle()
  return data
}

export async function getBollaForViewer(id: string) {
  const auth = await createClient()
  const {
    data: { user },
  } = await auth.auth.getUser()
  if (!user) return null

  const profile = await getProfile()
  if (!profile) return null

  const isAdmin = isAdminProfile(profile)
  const service = createServiceClient()

  if (isAdmin) {
    const { data: viaService } = await service.from('bolle').select(BOLLA_SELECT).eq('id', id).maybeSingle()
    if (viaService) return viaService
    const { data: viaAuth } = await auth.from('bolle').select(BOLLA_SELECT).eq('id', id).maybeSingle()
    return viaAuth
  }

  const { data: viaUser } = await auth.from('bolle').select(BOLLA_SELECT).eq('id', id).maybeSingle()
  if (viaUser) return viaUser

  const { data: row } = await service.from('bolle').select('sede_id, fornitore_id').eq('id', id).maybeSingle()
  if (!row) return null
  if (!(await operatoreCanAccessBolla(service, row, profile.sede_id))) return null

  const { data } = await service.from('bolle').select(BOLLA_SELECT).eq('id', id).maybeSingle()
  return data
}

/** Chiamare solo dopo `getBollaForViewer` riuscita (stessa sede/fornitore delle fatture collegate). */
export async function getFattureRowsForBollaAuthorized(bollaId: string) {
  const service = createServiceClient()
  const { data } = await service
    .from('fatture')
    .select('*')
    .eq('bolla_id', bollaId)
    .order('data', { ascending: false })
  return data ?? []
}
