import { describe, expect, it } from 'vitest'
import { resolveBolleMatchForPendingInvoice } from '@/lib/auto-resolve-pending-doc'

describe('resolveBolleMatchForPendingInvoice', () => {
  it('without fallback excludes bolle whose date is far from invoice date', () => {
    const bolle = [{ id: 'a', importo: 100, data: '2026-04-29' }]
    expect(resolveBolleMatchForPendingInvoice(bolle, 100, '2025-07-10')).toBeNull()
  })

  it('includes bolle reachable via fallbackInvoiceDocIso (e.g. receipt vs invoice date mismatch)', () => {
    const bolle = [{ id: 'a', importo: 100, data: '2026-04-29' }]
    expect(
      resolveBolleMatchForPendingInvoice(bolle, 100, '2025-07-10', {
        fallbackInvoiceDocIso: '2026-04-29',
      }),
    ).toEqual(['a'])
  })

  it('expanded window catches bolle between invoice-year and receipt-year anchors', () => {
    const bolle = [{ id: 'mid', importo: 42, data: '2026-03-01' }]
    expect(
      resolveBolleMatchForPendingInvoice(bolle, 42, '2025-07-10', {
        fallbackInvoiceDocIso: '2026-04-29',
        windowDays: 330,
      }),
    ).toEqual(['mid'])
  })
})
