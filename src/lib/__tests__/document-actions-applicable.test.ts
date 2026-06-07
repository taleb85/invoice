import { describe, expect, it } from 'vitest'
import { actionIdsForOrigine, isActionApplicableForOrigine } from '@/lib/document-actions-applicable'

describe('document-actions-applicable', () => {
  it('includes full bolla action set', () => {
    const ids = actionIdsForOrigine('bolla')
    expect(ids).toContain('bolla.converti_in_fattura')
    expect(ids).toContain('documento.aggiorna_categoria')
    expect(ids).toContain('bolla.rianalizza_ocr')
    expect(ids).toContain('documento.apri')
    expect(ids).toContain('bolla.elimina')
  })

  it('treats bolla_aperta like bolla', () => {
    expect(actionIdsForOrigine('bolla_aperta')).toEqual(actionIdsForOrigine('bolla'))
  })

  it('does not expose invoice-only actions on bolle', () => {
    expect(isActionApplicableForOrigine('fattura.approva', 'bolla')).toBe(false)
  })
})
