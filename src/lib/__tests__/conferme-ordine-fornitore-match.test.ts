import { describe, expect, it } from 'vitest'
import {
  confermeOrdineBelongsToFornitore,
  resolveFornitoreIdFromCompanyLabel,
} from '@/lib/conferme-ordine-fornitore-match'

const fornitori = [
  { id: 'f-pasta', nome: 'The Fresh Pasta Company', display_name: null },
  { id: 'f-enotria', nome: 'Enotria Winecellars Ltd', display_name: 'ENOTRIA' },
]

describe('conferme-ordine-fornitore-match', () => {
  it('risolve il fornitore dal titolo documento', () => {
    expect(resolveFornitoreIdFromCompanyLabel('The Fresh Pasta Company', fornitori)).toBe('f-pasta')
    expect(resolveFornitoreIdFromCompanyLabel('ENOTRIA order 12', fornitori)).toBe('f-enotria')
  })

  it('esclude conferme assegnate al fornitore sbagliato', () => {
    expect(
      confermeOrdineBelongsToFornitore(
        { fornitore_id: 'f-enotria', titolo: 'The Fresh Pasta Company', file_name: null },
        'f-enotria',
        fornitori,
      ),
    ).toBe(false)
    expect(
      confermeOrdineBelongsToFornitore(
        { fornitore_id: 'f-pasta', titolo: 'The Fresh Pasta Company', file_name: null },
        'f-pasta',
        fornitori,
      ),
    ).toBe(true)
  })

  it('mantiene titoli generici senza nome fornitore', () => {
    expect(
      confermeOrdineBelongsToFornitore(
        { fornitore_id: 'f-enotria', titolo: 'Order confirmation #4582', file_name: null },
        'f-enotria',
        fornitori,
      ),
    ).toBe(true)
  })
})
