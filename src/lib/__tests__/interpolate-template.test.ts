import { describe, expect, it } from 'vitest'
import { interpolateTemplate } from '@/lib/interpolate-template'

describe('interpolateTemplate', () => {
  it('replaces placeholders', () => {
    expect(interpolateTemplate('{a} + {b}', { a: 1, b: 2 })).toBe('1 + 2')
  })

  it('returns fallback when template is missing', () => {
    expect(interpolateTemplate(undefined, { n: 5 }, 'fallback')).toBe('fallback')
  })
})
