import { describe, expect, it } from 'vitest'
import { buildEdenSpringsFixPlan } from '@/lib/eden-springs-fix'
import { shouldSkipEmailAutoFattura } from '@/lib/uk-account-invoice-guard'

describe('buildEdenSpringsFixPlan', () => {
  it('clears misused account numbers and dedupes same file', () => {
    const plan = buildEdenSpringsFixPlan(
      [
        {
          id: 'a',
          fornitore_id: 'f1',
          sede_id: 's1',
          data: '2026-03-31',
          importo: 100,
          numero_fattura: '316074277',
          file_url: 'https://x/doc.pdf',
          bolla_id: null,
          approval_status: 'approved',
        },
        {
          id: 'b',
          fornitore_id: 'f1',
          sede_id: 's1',
          data: '2026-03-31',
          importo: null,
          numero_fattura: '316074277',
          file_url: 'https://x/doc.pdf',
          bolla_id: null,
          approval_status: null,
        },
      ],
      new Map([['f1', 'Eden Springs UK Ltd']]),
    )
    expect(plan.clear_numero).toHaveLength(2)
    expect(plan.delete_ids).toContain('b')
    expect(plan.delete_ids).not.toContain('a')
  })
})

describe('shouldSkipEmailAutoFattura', () => {
  it('blocks auto fattura when numero is UK account without invoice segment', () => {
    expect(
      shouldSkipEmailAutoFattura({
        tipo_documento: 'fattura',
        numero_fattura: '316074277',
        ragione_sociale: 'Eden Springs UK Ltd',
        p_iva: null,
        indirizzo: null,
        data_fattura: '2026-03-31',
        totale_iva_inclusa: 100,
        nome: null,
        piva: null,
        data: null,
      }),
    ).toBe(true)
  })
})
