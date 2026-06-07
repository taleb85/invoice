import { describe, expect, it } from 'vitest'
import { progressStepsForAction } from '@/lib/document-action-progress-steps'
import en from '@/lib/translations/en'

describe('document-action-progress-steps', () => {
  it('returns 3 OCR steps for bolla re-analyze', () => {
    const steps = progressStepsForAction('bolla.rianalizza_ocr', en)
    expect(steps).toHaveLength(3)
    expect(steps[1]).toBe(en.documentActions.execStepOcr)
  })

  it('returns single step for open document', () => {
    expect(progressStepsForAction('documento.apri', en)).toEqual([
      en.documentActions.execStepOpen,
    ])
  })
})
