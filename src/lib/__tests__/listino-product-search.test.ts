import { describe, expect, it } from 'vitest'
import {
  expandProductSearchTerms,
  getSearchConceptGroups,
  matchesProductSearchQuery,
} from '@/lib/listino-product-search'

describe('listino-product-search', () => {
  it('espande bufala in buffalo per la ricerca', () => {
    const terms = expandProductSearchTerms('mozzarella bufala')
    expect(terms).toContain('mozzarella')
    expect(terms).toContain('bufala')
    expect(terms).toContain('buffalo')
  })

  it('abbina mozzarella di bufala con buffalo mozzarella', () => {
    expect(
      matchesProductSearchQuery('buffalo mozzarella', 'Mozzarella di bufala DOP 125g'),
    ).toBe(true)
    expect(
      matchesProductSearchQuery('mozzarella bufala', 'Buffalo Mozzarella 2kg'),
    ).toBe(true)
  })

  it('non abbina prodotti senza i concetti cercati', () => {
    expect(
      matchesProductSearchQuery('mozzarella bufala', 'Olive oil extra virgin 5L'),
    ).toBe(false)
  })

  it('riconosce farina / flour', () => {
    const groups = getSearchConceptGroups('flour')
    expect(groups[0]).toContain('farina')
    expect(matchesProductSearchQuery('flour', 'Farina 00 tipo W 25kg')).toBe(true)
    expect(matchesProductSearchQuery('farina', 'Italian Strong White Flour 16kg')).toBe(true)
  })

  it('mantiene ricerca singola per nomi propri (es. gavi)', () => {
    expect(matchesProductSearchQuery('gavi', 'Gavi di Gavi Minaia 25')).toBe(true)
    expect(matchesProductSearchQuery('gavi', 'Chianti Classico 2022')).toBe(false)
  })
})
