import { describe, expect, it } from 'vitest'
import { contestoToJsonb, mittenteDomain, normalizeContestoJson } from '@/lib/action-learning/context'

describe('action-learning context', () => {
  it('estrae dominio mittente', () => {
    expect(mittenteDomain('Fatture@Acme.IT')).toBe('acme.it')
    expect(mittenteDomain('noreply')).toBe('noreply')
    expect(mittenteDomain(null)).toBeNull()
  })

  it('normalizza contesto coda senza email intera', () => {
    expect(
      normalizeContestoJson({
        origine: 'documento_da_processare',
        stato_origine: 'da_associare',
        pending_kind: 'fattura',
        mittente: 'fatture@fornitore.it',
        sede_id: 'sede-1',
        fornitore_id: 'forn-1',
      }),
    ).toEqual({
      origine: 'documento_da_processare',
      stato_origine: 'da_associare',
      pending_kind: 'fattura',
      mittente_domain: 'fornitore.it',
    })
  })

  it('normalizza contesto verifica senza file/anomalie', () => {
    expect(
      normalizeContestoJson({
        fonte: 'verifica_associazioni',
        action_originale: 'scarta',
        documento_categoria: 'fiscale',
        file_name: 'invoice-123.pdf',
        anomalie_count: 2,
      }),
    ).toEqual({
      fonte: 'verifica_associazioni',
      action_originale: 'scarta',
      documento_categoria: 'fiscale',
    })
  })

  it('contestoToJsonb allinea upsert client', () => {
    expect(
      contestoToJsonb({
        origine: 'riga_statement',
        stato_origine: 'mancante',
        pending_kind: 'statement',
        fornitore_id: 'f1',
        sede_id: 's1',
        mittente: 'accounts@supplier.co.uk',
      }),
    ).toEqual({
      origine: 'riga_statement',
      stato_origine: 'mancante',
      pending_kind: 'statement',
      mittente_domain: 'supplier.co.uk',
    })
  })
})
