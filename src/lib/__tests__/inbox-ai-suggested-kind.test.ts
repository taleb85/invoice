import { describe, expect, it } from 'vitest'
import {
  mapInboxTipoToPendingKind,
  resolveInboxDocTypeKind,
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

  it('maps bolla_ddt OCR tipo to bolla for display', () => {
    expect(mapInboxTipoToPendingKind('bolla_ddt')).toBe('bolla')
  })

  it('resolveInboxDocTypeKind uses tipo_documento when no AI suggestion', () => {
    expect(resolveInboxDocTypeKind({ tipo_documento: 'fattura' }, null)).toBe('fattura')
    expect(resolveInboxDocTypeKind({ tipo_documento: 'bolla_ddt' }, null)).toBe('bolla')
  })

  it('resolveInboxDocTypeKind falls back to da_determinare', () => {
    expect(resolveInboxDocTypeKind({}, null)).toBe('da_determinare')
  })
})
