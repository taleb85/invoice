import { createServiceClient, getProfile } from '@/utils/supabase/server'

export type ClearAiUsageOutcome =
  | { ok: true; deleted: number | null; mode: 'rpc' | 'filter' }
  | { ok: false; error: string; status: 403 | 500 }

async function wipeAiUsageLogViaPostgrest(
  service: ReturnType<typeof createServiceClient>,
): Promise<{ deleted: number | null; mode: 'rpc' | 'filter' } | { error: string }> {
  const rpc = await service.rpc('delete_all_ai_usage_log')

  if (!rpc.error && rpc.data !== null && rpc.data !== undefined) {
    const raw = rpc.data
    const n =
      typeof raw === 'bigint'
        ? Number(raw)
        : typeof raw === 'string'
          ? Number(raw)
          : typeof raw === 'number'
            ? raw
            : null
    const deleted = n != null && Number.isFinite(n) ? Math.trunc(n) : 0
    return { deleted, mode: 'rpc' }
  }

  const { error: e1, count: c1 } = await service
    .from('ai_usage_log')
    .delete({ count: 'exact' })
    .gte('tokens_input', -1)

  if (!e1) {
    return { deleted: typeof c1 === 'number' ? c1 : null, mode: 'filter' }
  }

  console.error('[ai-usage-delete]', e1.message)

  const { error: e2, count: c2 } = await service
    .from('ai_usage_log')
    .delete({ count: 'exact' })
    .gte('tokens_output', -1)

  if (!e2) {
    return { deleted: typeof c2 === 'number' ? c2 : null, mode: 'filter' }
  }

  console.error('[ai-usage-delete] fallback', e2.message)
  return { error: e2.message ?? e1.message ?? 'Eliminazione non riuscita' }
}

/** Svuota `ai_usage_log`: solo admin master, service role. Usato da route API e da Server Action. */
export async function clearAiUsageLogForAdmin(): Promise<ClearAiUsageOutcome> {
  const profile = await getProfile()
  if (!profile || String(profile.role ?? '').toLowerCase() !== 'admin') {
    return { ok: false, error: 'Accesso negato', status: 403 }
  }

  const service = createServiceClient()
  const result = await wipeAiUsageLogViaPostgrest(service)

  if ('error' in result) {
    return { ok: false, error: result.error, status: 500 }
  }

  return {
    ok: true,
    deleted: result.deleted,
    mode: result.mode,
  }
}
