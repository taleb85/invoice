import { describe, expect, it } from 'vitest'
import { findSuspiciousInProductGroup, findSuspiciousListinoRows } from '@/lib/listino-price-audit'

const fid = '00000000-0000-4000-8000-000000000001'

describe('findSuspiciousInProductGroup', () => {
  it('flags qty 0.75 in a case-price series', () => {
    const group = [
      { id: '1', fornitore_id: fid, prodotto: 'Minestrone', prezzo: 37.6, data_prezzo: '2026-01-01' },
      { id: '2', fornitore_id: fid, prodotto: 'Minestrone', prezzo: 0.75, data_prezzo: '2026-02-01' },
      { id: '3', fornitore_id: fid, prodotto: 'Minestrone', prezzo: 38.7, data_prezzo: '2026-03-01' },
      { id: '4', fornitore_id: fid, prodotto: 'Minestrone', prezzo: 38.7, data_prezzo: '2026-04-01' },
    ]
    const bad = findSuspiciousInProductGroup(group)
    expect(bad.map((r) => r.id)).toEqual(['2'])
  })

  it('flags qty 7 below dominant recurring price', () => {
    const group = Array(10)
      .fill(null)
      .map((_, i) => ({
        id: `h${i}`,
        fornitore_id: fid,
        prodotto: 'Water',
        prezzo: 8.53,
        data_prezzo: `2026-01-${String(i + 1).padStart(2, '0')}`,
      }))
      .concat([
        { id: 'bad', fornitore_id: fid, prodotto: 'Water', prezzo: 7, data_prezzo: '2026-02-01' },
      ])
    expect(findSuspiciousInProductGroup(group).map((r) => r.id)).toEqual(['bad'])
  })

  it('flags qty 7 in Menabrea-like series', () => {
    const group = [
      { id: 'a', fornitore_id: fid, prodotto: 'Beer', prezzo: 35.66, data_prezzo: '2026-01-01' },
      { id: 'b', fornitore_id: fid, prodotto: 'Beer', prezzo: 7, data_prezzo: '2026-02-01' },
      { id: 'c', fornitore_id: fid, prodotto: 'Beer', prezzo: 36.04, data_prezzo: '2026-03-01' },
      { id: 'd', fornitore_id: fid, prodotto: 'Beer', prezzo: 7, data_prezzo: '2026-04-01' },
    ]
    expect(findSuspiciousInProductGroup(group).map((r) => r.id).sort()).toEqual(['b', 'd'])
  })
})

describe('findSuspiciousListinoRows', () => {
  it('does not flag legitimate bottle unit prices', () => {
    const rows = [
      { id: '1', fornitore_id: fid, prodotto: 'Prosecco', prezzo: 8.36, data_prezzo: '2026-01-01' },
      { id: '2', fornitore_id: fid, prodotto: 'Prosecco', prezzo: 84.5, data_prezzo: '2026-02-01' },
      { id: '3', fornitore_id: fid, prodotto: 'Prosecco', prezzo: 85.0, data_prezzo: '2026-03-01' },
      { id: '4', fornitore_id: fid, prodotto: 'Prosecco', prezzo: 84.0, data_prezzo: '2026-04-01' },
    ]
    expect(findSuspiciousListinoRows(rows)).toHaveLength(0)
  })
})
