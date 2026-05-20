import type { SupabaseClient } from '@supabase/supabase-js'
import { getGeminiModelId, getGeminiPricing, type GeminiUsage } from '@/lib/gemini-vision'

export async function recordAiUsage(
  supabase: SupabaseClient,
  input: {
    sede_id: string | null
    documento_id?: string | null
    tipo: string
    usage: GeminiUsage
    model?: string
  },
): Promise<void> {
  const tokensIn = input.usage.inputTokens
  const tokensOut = input.usage.outputTokens
  const p = getGeminiPricing()
  const costUsd =
    input.usage.estimatedCostUsd ??
    (tokensIn * p.inputPerMillion + tokensOut * p.outputPerMillion) / 1_000_000

  const row = {
    sede_id: input.sede_id,
    documento_id: input.documento_id ?? null,
    model: input.model ?? getGeminiModelId(),
    tokens_input: tokensIn,
    tokens_output: tokensOut,
    costo_usd: Math.round(costUsd * 100_000_000) / 100_000_000,
    tipo: input.tipo,
  }

  const { error } = await supabase.from('ai_usage_log').insert(row)
  if (error) {
    console.error('[ai_usage_log]', error.message)
  }
}
