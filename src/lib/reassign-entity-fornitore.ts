import { cookies } from 'next/headers'
import { createServiceClient, getProfile } from '@/utils/supabase/server'
import { logActivity, ACTIVITY_ACTIONS } from '@/lib/activity-logger'
import { isMasterAdminRole, isSedePrivilegedRole } from '@/lib/roles'
import type { Profile } from '@/types'

export type EntityTable = 'fatture' | 'bolle'

export interface ReassignEntityOpts {
  entityId: string
  nuovoFornitoreId: string
  sedeId: string
  userId: string
}

export interface ReassignEntityResult {
  error?: string
  status?: number
}

export function resolveSedeId(profile: Profile, bodySede: string | undefined, cookieSede: string | null): string | null {
  const master = isMasterAdminRole(profile.role)
  const branch = isSedePrivilegedRole(profile.role)

  if (branch && profile.sede_id) {
    const fromBody = bodySede?.trim()
    if (fromBody && fromBody !== profile.sede_id) return null
    return profile.sede_id
  }

  if (!master) return null
  return bodySede?.trim() || cookieSede?.trim() || profile.sede_id?.trim() || null
}

export async function requireReassignAuth(): Promise<{
  profile: Profile
  sedeId: string | null
  error?: { error: string; status: number }
}> {
  const profile = await getProfile()
  if (!profile) return { profile: null as unknown as Profile, sedeId: null, error: { error: 'Non autenticato', status: 401 } }

  const master = isMasterAdminRole(profile.role)
  const privileged = isSedePrivilegedRole(profile.role)
  if (!master && !privileged) {
    return { profile, sedeId: null, error: { error: 'Accesso negato', status: 403 } }
  }

  const cookieStore = await cookies()
  const adminPick = cookieStore.get('admin-sede-id')?.value ?? null
  const sedeId = resolveSedeId(profile, undefined, adminPick)

  return { profile, sedeId }
}

/**
 * Riassegna una fattura o bolla a un nuovo fornitore, con tutti i controlli:
 * - verifica che l'entità appartenga alla sede
 * - verifica che il nuovo fornitore sia della stessa sede
 * - evita reassign se il fornitore è già quello attuale
 * - registra activity log
 */
export async function reassignEntityFornitore(
  table: EntityTable,
  opts: ReassignEntityOpts,
): Promise<ReassignEntityResult> {
  const { entityId, nuovoFornitoreId, sedeId, userId } = opts
  const service = createServiceClient()

  const { data: entity, error: entityErr } = await service
    .from(table)
    .select('id, sede_id, fornitore_id, fornitore:fornitori(sede_id)')
    .eq('id', entityId)
    .maybeSingle()

  if (entityErr || !entity) {
    return { error: `${table === 'fatture' ? 'Fattura' : 'Bolla'} non trovata`, status: 404 }
  }

  const fornitoreRow = entity.fornitore as { sede_id?: string | null } | null | undefined
  const entitySede = (entity.sede_id as string | null) ?? fornitoreRow?.sede_id ?? null
  if (!entitySede || entitySede !== sedeId) {
    return { error: `L'entità non appartiene alla sede selezionata`, status: 403 }
  }

  if (entity.fornitore_id === nuovoFornitoreId) {
    return { error: 'Il fornitore selezionato è già quello attuale', status: 400 }
  }

  const { data: nuovoForn } = await service
    .from('fornitori')
    .select('id, sede_id')
    .eq('id', nuovoFornitoreId)
    .maybeSingle()
  if (!nuovoForn?.id) return { error: 'Fornitore non trovato', status: 404 }
  if (nuovoForn.sede_id !== sedeId) {
    return { error: 'Il nuovo fornitore non appartiene a questa sede', status: 403 }
  }

  const { error: uErr } = await service
    .from(table)
    .update({ fornitore_id: nuovoFornitoreId })
    .eq('id', entityId)
  if (uErr) return { error: uErr.message, status: 500 }

  const action = table === 'fatture' ? ACTIVITY_ACTIONS.FATTURA_REASSIGNED : ACTIVITY_ACTIONS.BOLLA_REASSIGNED
  await logActivity(service, {
    userId,
    sedeId,
    action,
    entityType: table === 'fatture' ? 'fattura' : 'bolla',
    entityId,
    metadata: { nuovo_fornitore_id: nuovoFornitoreId },
  })

  return {}
}
