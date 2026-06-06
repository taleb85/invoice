import { describe, expect, it, vi } from 'vitest'
import { promotePrimaryFornitoreEmailIfEmpty } from '@/lib/fornitore-email-primary'

describe('promotePrimaryFornitoreEmailIfEmpty', () => {
  it('sets primary email when empty', async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({ error: null }),
      }),
    })
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'fornitori') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { email: null } }),
              }),
            }),
            update,
          }
        }
        return {}
      }),
    }

    const ok = await promotePrimaryFornitoreEmailIfEmpty(
      supabase as never,
      '539595ca-34ab-4596-9146-9fa7746250fb',
      'info@vandscateringsupplies.co.uk',
    )

    expect(ok).toBe(true)
    expect(update).toHaveBeenCalledWith({ email: 'info@vandscateringsupplies.co.uk' })
  })

  it('skips when primary email already set', async () => {
    const update = vi.fn()
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { email: 'existing@example.com' } }),
          }),
        }),
        update,
      })),
    }

    const ok = await promotePrimaryFornitoreEmailIfEmpty(
      supabase as never,
      '539595ca-34ab-4596-9146-9fa7746250fb',
      'info@vandscateringsupplies.co.uk',
    )

    expect(ok).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })
})
