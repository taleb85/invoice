import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { CommandId, CodaItem } from '@/lib/command-system/types'
import { contestoToJsonb, estraiContesto } from '@/lib/action-learning/context'

export type RpcSuggestRow = {
  azione_id?: string
  confidenza?: number
  totali_conferme?: number
  match_tipo?: string
}

export function parseSuggestRpcRow(data: unknown): RpcSuggestRow | null {
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return null
  return row as RpcSuggestRow
}

export async function rpcCalcolaConfidenza(
  supabase: SupabaseClient,
  item: CodaItem,
): Promise<{ data: RpcSuggestRow | null; error: string | null }> {
  const contesto = estraiContesto(item)
  const { data, error } = await supabase.rpc('calcola_confidenza_suggerimento', {
    p_sede_id: contesto.sede_id,
    p_fornitore_id: contesto.fornitore_id,
    p_contesto: contestoToJsonb(contesto),
  })
  if (error) return { data: null, error: error.message }
  return { data: parseSuggestRpcRow(data), error: null }
}

export async function rpcUpsertActionLearning(
  supabase: SupabaseClient,
  item: CodaItem,
  azioneId: CommandId,
  eraSuggerimento: boolean,
  seguitoConsiglio: boolean,
): Promise<{ ok: boolean; error: string | null }> {
  const contesto = estraiContesto(item)
  const { error } = await supabase.rpc('upsert_action_learning', {
    p_sede_id: contesto.sede_id,
    p_fornitore_id: contesto.fornitore_id,
    p_contesto: contestoToJsonb(contesto),
    p_azione_id: azioneId,
    p_era_suggerimento: eraSuggerimento,
    p_seguito_consiglio: seguitoConsiglio,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, error: null }
}
