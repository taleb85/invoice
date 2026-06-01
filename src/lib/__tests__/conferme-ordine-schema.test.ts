import { describe, expect, it } from 'vitest'
import {
  confermeOrdineTableMissingFromApiError,
  confermeOrdineTableUnavailable,
} from '@/lib/conferme-ordine-schema'

describe('conferme-ordine-schema', () => {
  it('treats missing numero_ordine column as table available', () => {
    const msg =
      "Could not find the 'numero_ordine' column of 'conferme_ordine' in the schema cache"
    expect(confermeOrdineTableUnavailable({ message: msg })).toBe(false)
    expect(confermeOrdineTableMissingFromApiError(msg)).toBe(false)
  })

  it('treats missing table as unavailable', () => {
    const msg = 'relation "public.conferme_ordine" does not exist'
    expect(confermeOrdineTableUnavailable({ message: msg, code: '42P01' })).toBe(true)
    expect(confermeOrdineTableMissingFromApiError(msg)).toBe(true)
  })
})
