import { describe, expect, it } from 'vitest'
import { confermeOrdineBelongsToFornitore } from '@/lib/conferme-ordine-fornitore-match'

const fornitori = [
  { id: 'f-pasta', nome: 'The Fresh Pasta Company', display_name: null },
  { id: 'f-enotria', nome: 'Enotria Winecellars Ltd', display_name: 'ENOTRIA' },
]

describe('conferme-ordine-fornitore-match', () => {
  it('esclude conferme assegnate al fornitore sbagliato (peer in sede)', () => {
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

  it('esclude nome fornitore nel titolo anche se il peer non è in anagrafica', () => {
    expect(
      confermeOrdineBelongsToFornitore(
        { fornitore_id: 'f-enotria', titolo: 'The Fresh Pasta Company', file_name: null },
        'f-enotria',
        [{ id: 'f-enotria', nome: 'Enotria Winecellars Ltd', display_name: 'ENOTRIA' }],
      ),
    ).toBe(false)
  })

  it('usa ragione_sociale OCR quando presente', () => {
    expect(
      confermeOrdineBelongsToFornitore(
        {
          fornitore_id: 'f-enotria',
          titolo: 'Order SO123',
          ragione_sociale: 'The Fresh Pasta Company',
        },
        'f-enotria',
        fornitori,
      ),
    ).toBe(false)
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
