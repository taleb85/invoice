/**
 * Compares invoice line items (extracted via AI from the fattura PDF) against
 * the listino_prezzi table and returns items where the paid price exceeds the
 * listed reference price by more than `threshold` (default 5 %).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type AnomalyResult = {
  prodotto: string
  prezzoPagato: number
  prezzoListino: number
  differenzaPercent: number
  fatturaId: string
  fornitoreId: string
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function wordSimilarity(a: string, b: string): number {
  const wa = new Set(a.split(' ').filter(Boolean))
  const wb = new Set(b.split(' ').filter(Boolean))
  const intersection = [...wa].filter((w) => wb.has(w)).length
  return intersection / Math.max(wa.size, wb.size, 1)
}

export async function checkPriceAnomalies(
  supabase: SupabaseClient,
  fatturaId: string,
  fornitoreId: string,
  threshold = 0.05,
): Promise<AnomalyResult[]> {
  // 1. Get most recent listino price per product for this fornitore
  const { data: listinoData, error: listinoErr } = await supabase
    .from('listino_prezzi')
    .select('prodotto, prezzo, data_prezzo')
    .eq('fornitore_id', fornitoreId)
    .order('data_prezzo', { ascending: false })
    .limit(5000)

  if (listinoErr || !listinoData?.length) return []

  // Deduplicate: keep most recent price per product (already sorted desc by data_prezzo)
  const listino = new Map<string, { originalKey: string; prezzo: number }>()
  for (const row of listinoData as { prodotto: string; prezzo: number }[]) {
    const key = normalize(row.prodotto)
    if (key && !listino.has(key)) {
      listino.set(key, { originalKey: row.prodotto, prezzo: row.prezzo })
    }
  }

  if (!listino.size) return []

  // 2. Extract line items from the fattura PDF via internal AI route
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'http://localhost:3000'

  let items: { prodotto: string; prezzo: number }[] = []
  try {
    const res = await fetch(`${baseUrl}/api/listino/importa-da-fattura`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fattura_id: fatturaId }),
    })
    if (res.ok) {
      const json = (await res.json()) as { items?: unknown[] }
      items = (json.items ?? []).filter(
        (it): it is { prodotto: string; prezzo: number } =>
          typeof (it as Record<string, unknown>).prodotto === 'string' &&
          typeof (it as Record<string, unknown>).prezzo === 'number' &&
          (it as { prezzo: number }).prezzo > 0,
      )
    }
  } catch {
    return []
  }

  if (!items.length) return []

  // 3. Match each item to the listino and flag anomalies
  const anomalies: AnomalyResult[] = []

  for (const item of items) {
    const normItem = normalize(item.prodotto)
    if (!normItem) continue

    // Exact match first, then best word-overlap ≥ 70 %
    let bestKey: string | null = null
    let bestSim = 0

    for (const [key] of listino) {
      if (key === normItem) {
        bestKey = key
        bestSim = 1
        break
      }
      const sim = wordSimilarity(normItem, key)
      if (sim > bestSim && sim >= 0.7) {
        bestSim = sim
        bestKey = key
      }
    }

    if (!bestKey) continue

    const { prezzo: prezzoListino } = listino.get(bestKey)!
    if (!Number.isFinite(prezzoListino) || prezzoListino <= 0) continue

    const prezzoPagato = item.prezzo
    const differenzaPercent = (prezzoPagato - prezzoListino) / prezzoListino

    if (differenzaPercent > threshold) {
      anomalies.push({
        prodotto: item.prodotto,
        prezzoPagato,
        prezzoListino,
        differenzaPercent,
        fatturaId,
        fornitoreId,
      })
    }
  }

  return anomalies.sort((a, b) => b.differenzaPercent - a.differenzaPercent)
}
