import { describe, expect, it } from 'vitest'
import {
  findStatementRowByNumeroDoc,
  normalizeNumeroFattura,
} from '@/lib/fattura-duplicate-check'

describe('normalizeNumeroFattura', () => {
  it('trims whitespace', () => {
    expect(normalizeNumeroFattura('  53101  ')).toBe('53101')
  })

  it('strips leading zeros on pure numeric document numbers', () => {
    expect(normalizeNumeroFattura('0053101')).toBe('53101')
    expect(normalizeNumeroFattura('53101')).toBe('53101')
    expect(normalizeNumeroFattura('0053101')).toBe(normalizeNumeroFattura('53101'))
  })

  it('keeps single zero', () => {
    expect(normalizeNumeroFattura('0')).toBe('0')
    expect(normalizeNumeroFattura('000')).toBe('0')
  })

  it('does not alter alphanumeric references', () => {
    expect(normalizeNumeroFattura('INV-0053101')).toBe('INV-0053101')
  })
})

describe('findStatementRowByNumeroDoc', () => {
  it('matches rows with different leading zeros', () => {
    const rows = [{ id: '1', numero_doc: '0053101' }]
    expect(findStatementRowByNumeroDoc(rows, '53101')?.id).toBe('1')
  })
})
