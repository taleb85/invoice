import { describe, expect, it } from 'vitest'
import {
  isLikelyQtyOcrPrice,
  isPlausibleListinoPrice,
  rejectReasonForListinoPrice,
} from '@/lib/listino-price-sanity'

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

describe('isLikelyQtyOcrPrice', () => {
  it('does not flag bottle unit prices', () => {
    const hist = [84, 85, 84.5]
    expect(isLikelyQtyOcrPrice(8.36, hist)).toBe(false)
    expect(isLikelyQtyOcrPrice(1.48, [35.66, 36.04])).toBe(false)
  })

  it('flags whole-number qty below dominant case price (Hildon 7 vs 8.53)', () => {
    const hist = Array(20).fill(8.53).concat([15, 17, 12, 10])
    expect(isLikelyQtyOcrPrice(7, hist)).toBe(true)
    expect(isLikelyQtyOcrPrice(10, hist)).toBe(false)
  })
})
