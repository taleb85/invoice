import { describe, expect, it } from 'vitest'
import {
  deliveryNoteTermForList,
  statementAnomalyShortBolle,
  statementAnomalyBolleHint,
} from '../localization'

const tEn = {
  statements: {
    anomalyShortBolleNo: 'no {deliveryNote}',
    stmtAnomalyBolleHint: '{shortLabel} = invoice already linked, {deliveryNote} missing',
  },
}

const tIt = {
  statements: {
    anomalyShortBolleNo: 'senza {deliveryNote}',
    stmtAnomalyBolleHint: '«{shortLabel}» = fattura già collegata, manca il {deliveryNote}',
  },
}

describe('deliveryNoteTermForList', () => {
  it('uses DDT acronym only for Italy', () => {
    expect(deliveryNoteTermForList('IT')).toBe('DDT')
    expect(deliveryNoteTermForList('UK')).toBe('delivery note')
    expect(deliveryNoteTermForList('DE')).toBe('lieferschein')
  })
})

describe('statementAnomalyShortBolle', () => {
  it('shows DDT assenti for Italian sede', () => {
    expect(statementAnomalyShortBolle('IT', tEn)).toBe('DDT assenti')
    expect(statementAnomalyShortBolle('IT', tIt)).toBe('DDT assenti')
  })

  it('uses delivery note wording for UK, not DDT', () => {
    expect(statementAnomalyShortBolle('UK', tEn)).toBe('no delivery note')
    expect(statementAnomalyShortBolle('UK', tIt)).toBe('senza delivery note')
  })
})

describe('statementAnomalyBolleHint', () => {
  it('builds hint from country term', () => {
    expect(statementAnomalyBolleHint('UK', tEn)).toBe(
      'no delivery note = invoice already linked, delivery note missing',
    )
    expect(statementAnomalyBolleHint('IT', tIt)).toBe(
      '«DDT assenti» = fattura già collegata, manca il DDT',
    )
  })
})
