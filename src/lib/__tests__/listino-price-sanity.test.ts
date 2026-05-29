import { describe, expect, it } from 'vitest'
import {
  inferUnitPriceFromLineTotal,
  isBadListinoOcrPrice,
  isLikelyLineTotalOcrPrice,
  isLikelyQtyOcrPrice,
  isPlausibleListinoPrice,
  rejectReasonForListinoPrice,
  resolveEffectiveListinoUnitPrice,
} from '@/lib/listino-price-sanity'

describe('isPlausibleListinoPrice', () => {
  it('accepts when there is no history', () => {
    expect(isPlausibleListinoPrice(38.7, [])).toBe(true)
    expect(isPlausibleListinoPrice(38.7, [37.6])).toBe(true)
  })

  it('rejects Minestrone-like qty 0.75 vs case prices ~38', () => {
    const hist = [37.6, 37.6, 38.7, 38.7]
    expect(isPlausibleListinoPrice(0.75, hist)).toBe(false)
    expect(rejectReasonForListinoPrice(0.75, hist)).toBe('price_outlier_ocr')
  })

  it('rejects Menabrea-like qty 7 vs case prices ~36', () => {
    const hist = [35.66, 36.04, 35.66, 36.04]
    expect(isPlausibleListinoPrice(7, hist)).toBe(false)
  })

  it('rejects unit bottle price vs case cluster', () => {
    const hist = [35.66, 36.04, 35.66, 36.04]
    expect(isBadListinoOcrPrice(1.48, hist)).toBe(true)
    expect(isBadListinoOcrPrice(5.02, hist)).toBe(true)
    expect(isBadListinoOcrPrice(36.04, hist)).toBe(false)
  })

  it('accepts normal price drift', () => {
    const hist = [37.6, 37.6, 38.7]
    expect(isPlausibleListinoPrice(38.7, hist)).toBe(true)
    expect(isPlausibleListinoPrice(37.6, hist)).toBe(true)
  })
})

describe('line total OCR', () => {
  it('detects £45.68 as 6 × ~£7.61 unit price', () => {
    const hist = [7.55, 7.61, 7.58, 7.6]
    expect(inferUnitPriceFromLineTotal(45.68, hist)).toBeCloseTo(7.61, 2)
    expect(isLikelyLineTotalOcrPrice(45.68, hist)).toBe(true)
    expect(resolveEffectiveListinoUnitPrice(45.68, hist)).toBeCloseTo(7.61, 2)
    expect(isBadListinoOcrPrice(45.68, hist)).toBe(true)
  })

  it('does not treat legitimate case price as line total', () => {
    const hist = [35.66, 36.04, 35.66, 36.04]
    expect(inferUnitPriceFromLineTotal(36.04, hist)).toBeNull()
    expect(isBadListinoOcrPrice(36.04, hist)).toBe(false)
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
