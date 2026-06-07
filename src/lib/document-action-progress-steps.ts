import type { CommandId } from '@/lib/command-system/types'
import type { Translations } from '@/lib/translations'

function isOcrAction(actionId: CommandId): boolean {
  return actionId.includes('ocr') || actionId.includes('rianalizza')
}

function isRegisterAction(actionId: CommandId): boolean {
  return (
    actionId.startsWith('documento.finalizza_') ||
    actionId === 'bolla.converti_in_fattura' ||
    actionId === 'fattura.approva' ||
    actionId === 'statement.segna_come_ok'
  )
}

export function progressStepsForAction(actionId: CommandId, t: Translations): string[] {
  const d = t.documentActions
  if (isOcrAction(actionId)) {
    return [d.execStepPrepare, d.execStepOcr, d.execStepSave]
  }
  if (isRegisterAction(actionId)) {
    return [d.execStepPrepare, d.execStepRegister, d.execStepDone]
  }
  if (actionId === 'documento.apri') {
    return [d.execStepOpen]
  }
  if (actionId === 'bolla.elimina' || actionId === 'documento.scarta' || actionId === 'documento.scarta_fattura') {
    return [d.execStepPrepare, d.execStepDelete, d.execStepDone]
  }
  return [d.execStepRunning]
}
