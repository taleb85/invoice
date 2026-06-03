import type { CommandId, CodaItem, AiSuggestion } from '@/lib/command-system/types'

export type { ContestoApprendimento } from '@/lib/action-learning/context'
export { estraiContesto, contestoToJsonb } from '@/lib/action-learning/context'

export async function suggerisciAzione(item: CodaItem): Promise<AiSuggestion | null> {
  try {
    const res = await fetch('/api/action-learning/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { suggestion?: AiSuggestion | null }
    return data.suggestion ?? null
  } catch (e) {
    console.warn('[ActionLearning] suggest error:', e instanceof Error ? e.message : e)
    return null
  }
}

export async function registraConfermaApprendimento(
  item: CodaItem,
  azioneId: CommandId,
  confermata: boolean,
): Promise<boolean> {
  return recordActionLearning(item, azioneId, true, confermata)
}

export async function registraEsecuzioneDiretta(
  item: CodaItem,
  azioneId: CommandId,
): Promise<boolean> {
  return recordActionLearning(item, azioneId, false, true)
}

async function recordActionLearning(
  item: CodaItem,
  azioneId: CommandId,
  eraSuggerimento: boolean,
  seguitoConsiglio: boolean,
): Promise<boolean> {
  try {
    const res = await fetch('/api/action-learning/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, azioneId, eraSuggerimento, seguitoConsiglio }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { ok?: boolean }
    return data.ok === true
  } catch (e) {
    console.error('[ActionLearning] record error:', e instanceof Error ? e.message : e)
    return false
  }
}
