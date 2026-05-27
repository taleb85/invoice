import { describe, expect, it } from 'vitest'
import { isPlausibleListinoPrice, rejectReasonForListinoPrice } from '@/lib/listino-price-sanity'

describe('isPlausibleListinoPrice', () => {
  it('accepts when there is no history', () => {
    expect(isPlausibleListinoPrice(38.7, [])).toBe(true)
    expect(isPlausibleListinoPrice(38.7, [37.6])).toBe(true)
  })

  it('rejects Minestrone-like qty 0.75 vs case prices ~38', () => {
    const hist = [37.6, 37.6, 38.7, 38.7]
    expect(isPlausibleListinoPrice(0.75, hist)).toBe(false)
    expect(rejectReasonForListinoPrice(0.75, hist)).toBe('price_outlier_likely_qty')
  })

  it('rejects Menabrea-like qty 7 vs case prices ~36', () => {
    const hist = [35.66, 36.04, 35.66, 36.04]
    expect(isPlausibleListinoPrice(7, hist)).toBe(false)
  })

  it('accepts normal price drift', () => {
    const hist = [37.6, 37.6, 38.7]
    expect(isPlausibleListinoPrice(38.7, hist)).toBe(true)
    expect(isPlausibleListinoPrice(37.6, hist)).toBe(true)
  })
})
