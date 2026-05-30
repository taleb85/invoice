import { describe, expect, it } from 'vitest'
import {
  mapInboxTipoToPendingKind,
  resolveInboxSuggestedKind,
} from '@/lib/inbox-ai-suggested-kind'

describe('inbox-ai-suggested-kind', () => {
  it('maps delivery note aliases to bolla', () => {
    expect(mapInboxTipoToPendingKind('ddt')).toBe('bolla')
    expect(mapInboxTipoToPendingKind('delivery_note')).toBe('bolla')
  })

  it('prefers session suggestion over metadata pending_kind', () => {
    const kind = resolveInboxSuggestedKind(
      { pending_kind: 'fattura', ai_tipo_suggerito: 'fattura' },
      'bolla',
    )
    expect(kind).toBe('bolla')
  })

  it('falls back to pending_kind when no session tipo', () => {
    expect(
      resolveInboxSuggestedKind({ pending_kind: 'listino', ai_tipo_suggerito: 'listino' }, null),
    ).toBe('listino')
  })
})
