export { tipoDocumentoDaPendingKind, pendingKindDaTipoDocumento } from './utils'
export type {
  CommandId,
  CommandGroup,
  DocumentOrigine,
  PendingKind,
  CodaItem,
  AiSuggestion,
  CommandContext,
  CommandPredicate,
  CommandExecutor,
  Command,
  CommandGroupInfo,
} from './types'

export {
  registraComando,
  getComando,
  tuttiComandi,
  comandiPerGruppo,
  comandiApplicabili,
  registraComandiMulti,
  GRUPPI,
} from './registry'

export { inizializzaComandi } from './commands'
