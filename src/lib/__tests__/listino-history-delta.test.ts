import { describe, expect, it } from 'vitest'
import {
  listinoHistoryDeltaPercent,
  previousPlausiblePriceByRowId,
  previousPlausiblePrimaryPriceByRowId,
} from '@/lib/listino-history-delta'

describe('listinoHistoryDeltaPercent', () => {
  it('avoids +177% when chronological prior is OCR outlier (Menabrea)', () => {
    const sorted = [
      { id: '1', prezzo: 35.66, data_prezzo: '2025-08-05' },
      { id: '2', prezzo: 1.48, data_prezzo: '2025-10-21' },
      { id: '3', prezzo: 12.84, data_prezzo: '2025-12-29' },
      { id: '4', prezzo: 35.66, data_prezzo: '2026-01-30' },
      { id: '5', prezzo: 36.04, data_prezzo: '2026-03-13' },
    ]
    const prev = previousPlausiblePriceByRowId(sorted)
    const pct = listinoHistoryDeltaPercent(35.66, prev.get('4'))
    expect(pct).not.toBeNull()
    expect(Math.abs(pct!)).toBeLessThan(5)
  })
})

describe('previousPlausiblePrimaryPriceByRowId', () => {
  it('computes delta on per-bottle prices for 6x75cl (premium wine)', () => {
    // With new display logic, £63-64 are bottle prices, not case totals.
    // A new entry at £64.84 should have < 2% delta vs prior £64.20.
    const sorted = [
      { id: '1', prezzo: 63.66, data_prezzo: '2025-01-01' },
      { id: '2', prezzo: 64.2, data_prezzo: '2026-01-01' },
    ]
    const prev = previousPlausiblePrimaryPriceByRowId(sorted, '6x75cl')
    const pct = listinoHistoryDeltaPercent(64.84, prev.get('2'))
    expect(pct).not.toBeNull()
    expect(Math.abs(pct!)).toBeLessThan(2)
  })
})
