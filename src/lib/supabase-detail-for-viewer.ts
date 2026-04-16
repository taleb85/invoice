/**
 * Caricamento bolle/fatture nelle Server Components con lo stesso criterio di
 * visibilità di open-document: admin via service role; operatore prima RLS, poi
 * verifica sede/fornitore se la riga non torna dal client anonimo.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Fattura } from '@/types'
import { createServiceClient, getProfile, getRequestAuth } from '@/utils/supabase/server'

/** Senza embed `bolla`: l’embed su `bolle` può far fallire l’intera riga se la bolla collegata non passa RLS (l’elenco cliente usa solo colonne su `fatture`). */
const FATTURA_CORE = '*, fornitore:fornitori(nome, email, piva, rekki_supplier_id)'
const BOLLA_EMBED_FIELDS = 'id, data, stato'
const BOLLA_SELECT = '*, fornitore:fornitori(nome, email, piva, rekki_supplier_id)'

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

async function attachBollaForViewer(
  auth: SupabaseClient,
  service: SupabaseClient,
  fattura: Fattura,
  ctx: { isAdmin: boolean; profileSedeId: string | null }
): Promise<Fattura> {
  const bollaId = fattura.bolla_id
  if (!bollaId) return fattura

  const { data: viaAuth } = await auth
    .from('bolle')
    .select(BOLLA_EMBED_FIELDS)
    .eq('id', bollaId)
    .maybeSingle()
  if (viaAuth) return { ...fattura, bolla: viaAuth as Fattura['bolla'] }

  if (ctx.isAdmin) {
    const { data } = await service.from('bolle').select(BOLLA_EMBED_FIELDS).eq('id', bollaId).maybeSingle()
    return data ? { ...fattura, bolla: data as Fattura['bolla'] } : fattura
  }

  const { data: bRow } = await service.from('bolle').select('sede_id, fornitore_id').eq('id', bollaId).maybeSingle()
  if (!bRow) return fattura
  if (!(await operatoreCanAccessBolla(service, bRow, ctx.profileSedeId))) return fattura

  const { data } = await service.from('bolle').select(BOLLA_EMBED_FIELDS).eq('id', bollaId).maybeSingle()
  return data ? { ...fattura, bolla: data as Fattura['bolla'] } : fattura
}

export async function getFatturaForViewer(id: string): Promise<Fattura | null> {
  const { supabase: auth, user } = await getRequestAuth()
  if (!user) return null

  const profile = await getProfile()
  if (!profile) return null

  const isAdmin = isAdminProfile(profile)
  const service = createServiceClient()

  const bollaCtx = { isAdmin, profileSedeId: profile.sede_id }

  if (isAdmin) {
    const { data: viaService } = await service.from('fatture').select(FATTURA_CORE).eq('id', id).maybeSingle()
    if (viaService) return attachBollaForViewer(auth, service, viaService as Fattura, bollaCtx)
    // Service role assente/errato in .env locale: RLS consente comunque SELECT agli admin.
    const { data: viaAuth } = await auth.from('fatture').select(FATTURA_CORE).eq('id', id).maybeSingle()
    if (!viaAuth) return null
    return attachBollaForViewer(auth, service, viaAuth as Fattura, bollaCtx)
  }

  const { data: viaUser } = await auth.from('fatture').select(FATTURA_CORE).eq('id', id).maybeSingle()
  if (viaUser) return attachBollaForViewer(auth, service, viaUser as Fattura, bollaCtx)

  const { data: row } = await service
    .from('fatture')
    .select('sede_id, fornitore_id')
    .eq('id', id)
    .maybeSingle()
  if (!row) return null
  if (!(await operatoreCanAccessFattura(service, row, profile.sede_id))) return null

  const { data } = await service.from('fatture').select(FATTURA_CORE).eq('id', id).maybeSingle()
  if (!data) return null
  return attachBollaForViewer(auth, service, data as Fattura, bollaCtx)
}

export async function getBollaForViewer(id: string) {
  const { supabase: auth, user } = await getRequestAuth()
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
