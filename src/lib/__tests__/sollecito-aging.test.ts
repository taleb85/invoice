import { describe, it, expect, vi } from 'vitest'
import {
  DEFAULT_SOLLECITI_TOLERANCE,
  fetchSollecitiToleranceConfig,
  isBollaOverdue,
  isPromisedDocOverdue,
  isStatementMismatchOverdue,
  statementCheckIsMismatch,
  parseDateOnlyOrIso,
  wholeDaysSinceUtc,
} from '@/lib/sollecito-aging'

describe('wholeDaysSinceUtc / parseDateOnlyOrIso', () => {
  it('conteggia giorni calendario UTC', () => {
    const from = parseDateOnlyOrIso('2026-01-01')!
    const now = new Date('2026-01-06T12:00:00Z')
    expect(wholeDaysSinceUtc(from, now)).toBe(5)
  })
})

describe('isBollaOverdue', () => {
  const now = new Date('2026-01-10T12:00:00Z')

  it('restituisce false se stato non è in attesa', () => {
    expect(
      isBollaOverdue({
        stato: 'completato',
        data: '2026-01-01',
        toleranceDays: 3,
        now,
      }),
    ).toBe(false)
  })

  it('restituisce false senza data documento', () => {
    expect(
      isBollaOverdue({
        stato: 'in attesa',
        data: null,
        toleranceDays: 3,
        now,
      }),
    ).toBe(false)
  })

  it('true quando i giorni dalla data documento sono >= tolleranza', () => {
    expect(
      isBollaOverdue({
        stato: 'in attesa',
        data: '2026-01-05',
        toleranceDays: 5,
        now,
      }),
    ).toBe(true)
  })

  it('false sotto soglia', () => {
    expect(
      isBollaOverdue({
        stato: 'in attesa',
        data: '2026-01-06',
        toleranceDays: 5,
        now,
      }),
    ).toBe(false)
  })
})

describe('isPromisedDocOverdue', () => {
  const now = new Date('2026-01-06T18:00:00Z')

  it('false se documentResolved', () => {
    expect(
      isPromisedDocOverdue({
        metadata: { promessa_invio_documento: true },
        recordCreatedAt: '2026-01-01T10:00:00Z',
        toleranceDays: 2,
        documentResolved: true,
        now,
      }),
    ).toBe(false)
  })

  it('false senza promessa in metadata', () => {
    expect(
      isPromisedDocOverdue({
        metadata: {},
        recordCreatedAt: '2026-01-01T10:00:00Z',
        toleranceDays: 2,
        documentResolved: false,
        now,
      }),
    ).toBe(false)
  })

  it('true con promessa e created_at abbastanza indietro', () => {
    expect(
      isPromisedDocOverdue({
        metadata: { promessa_invio_documento: true },
        recordCreatedAt: '2026-01-01T10:00:00Z',
        toleranceDays: 2,
        documentResolved: false,
        now,
      }),
    ).toBe(true)
  })
})

describe('statementCheckIsMismatch / isStatementMismatchOverdue', () => {
  const now = new Date('2026-03-05T14:00:00Z')

  it('matching stati errore triple-check', () => {
    expect(statementCheckIsMismatch('fattura_mancante')).toBe(true)
    expect(statementCheckIsMismatch('ok')).toBe(false)
    expect(statementCheckIsMismatch('pending')).toBe(false)
  })

  it('isStatementMismatchOverdue per riga errore sopra soglia', () => {
    expect(
      isStatementMismatchOverdue({
        checkStatus: 'fattura_mancante',
        rowCreatedAt: '2026-03-01T08:00:00Z',
        toleranceDays: 3,
        now,
      }),
    ).toBe(true)
  })

  it('false sotto soglia', () => {
    expect(
      isStatementMismatchOverdue({
        checkStatus: 'bolle_mancanti',
        rowCreatedAt: '2026-03-03T20:00:00Z',
        toleranceDays: 3,
        now,
      }),
    ).toBe(false)
  })
})

describe('fetchSollecitiToleranceConfig', () => {
  it('fallback ai default quando la query segnala errore', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'relation configurazioni_solleciti does not exist' },
        }),
      })),
    }
    await expect(fetchSollecitiToleranceConfig(supabase as never)).resolves.toEqual(
      DEFAULT_SOLLECITI_TOLERANCE,
    )
  })

  it('interpreta righe dalla tabella', async () => {
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockResolvedValue({
          data: [
            { chiave: 'giorni_tolleranza_bolla', valore: '7' },
            { chiave: 'giorni_tolleranza_promessa_documento', valore: '1' },
            { chiave: 'giorni_tolleranza_estratto_mismatch', valore: '4' },
          ],
          error: null,
        }),
      })),
    }
    await expect(fetchSollecitiToleranceConfig(supabase as never)).resolves.toEqual({
      giorniTolBolla: 7,
      giorniTolPromessa: 1,
      giorniTolEstrattoMismatch: 4,
    })
  })
})
