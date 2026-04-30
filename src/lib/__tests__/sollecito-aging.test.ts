import { describe, it, expect, vi } from 'vitest'
import {
  DEFAULT_SOLLECITI_TOLERANCE,
  fetchSollecitiToleranceConfig,
  fetchSollecitiReminderSettings,
  fetchSoglieSollecitiDocumenti,
  getSoglieSollecitiDocumentiFallback,
  canSendSolleciti,
  isBollaOverdue,
  isPromisedDocOverdue,
  isStatementMismatchOverdue,
  statementCheckIsMismatch,
  parseDateOnlyOrIso,
  wholeDaysSinceUtc,
} from '@/lib/sollecito-aging'

function mockSupabaseConfigMerge(opts: {
  app?: { data: unknown; error: { message: string } | null }
  legacy?: { data: unknown; error: { message: string } | null }
}) {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockResolvedValue(
        table === 'configurazioni_app'
          ? opts.app ?? { data: null, error: { message: 'missing' } }
          : opts.legacy ?? { data: null, error: { message: 'missing' } },
      ),
    })),
  }
}

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

  it('overload (bollaData, soglia): solo confronto data vs oggi, senza stato', () => {
    expect(isBollaOverdue('2026-01-05', 5, now)).toBe(true)
    expect(isBollaOverdue('2026-01-06', 5, now)).toBe(false)
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

  it('overload (metadata, createdAt, soglia)', () => {
    expect(
      isPromisedDocOverdue(
        { promessa_invio_documento: true },
        '2026-01-01T10:00:00Z',
        2,
        now,
      ),
    ).toBe(true)
    expect(
      isPromisedDocOverdue({ promessa_invio_documento: true }, '2026-01-05T10:00:00Z', 2, now),
    ).toBe(false)
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

describe('getSoglieSollecitiDocumentiFallback / fetchSoglieSollecitiDocumenti', () => {
  it('fallback statico 5 / 2 giorni', () => {
    expect(getSoglieSollecitiDocumentiFallback()).toEqual({
      giorniAttesaBolla: DEFAULT_SOLLECITI_TOLERANCE.giorniTolBolla,
      giorniAttesaPromessa: DEFAULT_SOLLECITI_TOLERANCE.giorniTolPromessa,
    })
  })

  it('fetch allinea a tolerance config (anche con DB fallito → default)', async () => {
    const dead = mockSupabaseConfigMerge({
      app: { data: null, error: { message: 'no table' } },
      legacy: { data: null, error: { message: 'no table' } },
    })
    await expect(fetchSoglieSollecitiDocumenti(dead as never)).resolves.toEqual(
      getSoglieSollecitiDocumentiFallback(),
    )
  })
})

describe('fetchSollecitiToleranceConfig', () => {
  it('fallback ai default quando entrambe le query falliscono', async () => {
    const supabase = mockSupabaseConfigMerge({
      app: { data: null, error: { message: 'relation configurazioni_app does not exist' } },
      legacy: { data: null, error: { message: 'relation configurazioni_solleciti does not exist' } },
    })
    await expect(fetchSollecitiToleranceConfig(supabase as never)).resolves.toEqual(
      DEFAULT_SOLLECITI_TOLERANCE,
    )
  })

  it('interpreta righe dalla tabella app (chiavi italiane)', async () => {
    const supabase = mockSupabaseConfigMerge({
      legacy: { data: [], error: null },
      app: {
        data: [
          { chiave: 'giorni_attesa_bolla', valore: '7' },
          { chiave: 'giorni_attesa_promessa', valore: '1' },
          { chiave: 'giorni_attesa_mismatch_estratto', valore: '4' },
        ],
        error: null,
      },
    })
    await expect(fetchSollecitiToleranceConfig(supabase as never)).resolves.toEqual({
      giorniTolBolla: 7,
      giorniTolPromessa: 1,
      giorniTolEstrattoMismatch: 4,
    })
  })

  it('interpreta chiavi legacy se app vuota', async () => {
    const supabase = mockSupabaseConfigMerge({
      app: { data: [], error: null },
      legacy: {
        data: [
          { chiave: 'giorni_tolleranza_bolla', valore: '7' },
          { chiave: 'giorni_tolleranza_promessa_documento', valore: '1' },
          { chiave: 'giorni_tolleranza_estratto_mismatch', valore: '4' },
        ],
        error: null,
      },
    })
    await expect(fetchSollecitiToleranceConfig(supabase as never)).resolves.toEqual({
      giorniTolBolla: 7,
      giorniTolPromessa: 1,
      giorniTolEstrattoMismatch: 4,
    })
  })
})

describe('fetchSollecitiReminderSettings', () => {
  it('autoSollecitiEnabled true quando la chiave manca', async () => {
    const supabase = mockSupabaseConfigMerge({
      legacy: {
        data: [
          { chiave: 'giorni_tolleranza_bolla', valore: '5' },
          { chiave: 'giorni_tolleranza_promessa_documento', valore: '2' },
          { chiave: 'giorni_tolleranza_estratto_mismatch', valore: '3' },
        ],
        error: null,
      },
      app: { data: [], error: null },
    })
    const r = await fetchSollecitiReminderSettings(supabase as never)
    expect(r.autoSollecitiEnabled).toBe(true)
    expect(r.giorniTolBolla).toBe(5)
  })

  it('preferisce chiavi italiane su configurazioni_app rispetto alle legacy', async () => {
    const supabase = mockSupabaseConfigMerge({
      legacy: {
        data: [{ chiave: 'giorni_tolleranza_bolla', valore: '1' }],
        error: null,
      },
      app: {
        data: [{ chiave: 'giorni_attesa_bolla', valore: '9' }],
        error: null,
      },
    })
    const r = await fetchSollecitiReminderSettings(supabase as never)
    expect(r.giorniTolBolla).toBe(9)
  })

  it('legge solleciti_automatici_attivi false', async () => {
    const supabase = mockSupabaseConfigMerge({
      legacy: { data: [], error: null },
      app: {
        data: [{ chiave: 'solleciti_automatici_attivi', valore: 'false' }],
        error: null,
      },
    })
    await expect(fetchSollecitiReminderSettings(supabase as never)).resolves.toMatchObject({
      autoSollecitiEnabled: false,
    })
  })

  it('legge auto_solleciti_enabled false (legacy)', async () => {
    const supabase = mockSupabaseConfigMerge({
      legacy: {
        data: [{ chiave: 'auto_solleciti_enabled', valore: 'false' }],
        error: null,
      },
      app: { data: [], error: null },
    })
    await expect(fetchSollecitiReminderSettings(supabase as never)).resolves.toMatchObject({
      autoSollecitiEnabled: false,
    })
  })
})

describe('canSendSolleciti', () => {
  it('true solo quando abilitati', () => {
    expect(canSendSolleciti({ autoSollecitiEnabled: true })).toBe(true)
    expect(canSendSolleciti({ autoSollecitiEnabled: false })).toBe(false)
  })
})
