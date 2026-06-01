import { describe, expect, it } from 'vitest'
import {
  confermaOrdineSortDayIso,
  sortConfermeOrdineByDocumentDateDesc,
  type ConfermaOrdineListRow,
} from '@/lib/conferme-ordine-query'

function row(partial: Partial<ConfermaOrdineListRow> & { id: string }): ConfermaOrdineListRow {
  return {
    id: partial.id,
    file_url: 'https://x/doc.pdf',
    file_name: null,
    titolo: null,
    numero_ordine: null,
    numero_fattura_doc: null,
    oggetto_mail: null,
    data_ordine: null,
    note: null,
    created_at: '2026-01-01T00:00:00Z',
    righe: null,
    fornitore_id: 'f1',
    data_ordine_display: null,
    ...partial,
  }
}

describe('sortConfermeOrdineByDocumentDateDesc', () => {
  it('orders by data_ordine_display descending', () => {
    const sorted = sortConfermeOrdineByDocumentDateDesc([
      row({ id: 'a', data_ordine_display: '2026-04-01' }),
      row({ id: 'b', data_ordine_display: '2026-06-15' }),
      row({ id: 'c', data_ordine_display: '2026-05-10' }),
    ])
    expect(sorted.map((r) => r.id)).toEqual(['b', 'c', 'a'])
  })

  it('prefers display date over stale DB column', () => {
    expect(
      confermaOrdineSortDayIso(
        row({ id: 'x', data_ordine: '2026-01-01', data_ordine_display: '2026-04-01' }),
      ),
    ).toBe('2026-04-01')
  })
})
