export type CommandId =
  | 'documento.scarta'
  | 'documento.associa'
  | 'documento.finalizza_come_fattura'
  | 'documento.finalizza_come_bolla'
  | 'documento.finalizza_come_nota_credito'
  | 'documento.finalizza_come_statement'
  | 'documento.finalizza_come_ordine'
  | 'documento.finalizza_come_comunicazione'
  | 'documento.finalizza_come_listino'
  | 'documento.set_pending_kind'
  | 'documento.rianalizza_ocr'
  | 'documento.ignora_mittente'
  | 'documento.apri'
  | 'documento.scarica'
  | 'documento.aggiorna_categoria'
  | 'fattura.approva'
  | 'fattura.rifiuta'
  | 'fattura.resetta_approvazione'
  | 'statement.segna_come_ok'
  | 'statement.assegna_fattura'
  | 'statement.ricalcola'
  | 'statement.associa_fornitore'

export type CommandGroup = 'documento' | 'fattura' | 'statement' | 'generale'

export type DocumentOrigine = 'documento_da_processare' | 'riga_statement' | 'fattura' | 'errore_sincronizzazione' | 'bolla_aperta'

export type PendingKind =
  | 'da_determinare'
  | 'fattura'
  | 'bolla'
  | 'nota_credito'
  | 'statement'
  | 'ordine'
  | 'comunicazione'
  | 'listino'

export interface CodaItem {
  id: string
  origine: DocumentOrigine
  stato_origine: string
  pending_kind: string
  fornitore_id: string | null
  fornitore_nome: string | null
  sede_id: string | null
  riferimenti: string | null
  nome_file: string | null
  data_doc: string | null
  data_inserimento: string | null
  file_url: string | null
  contesto_originale: Record<string, unknown> | null
  mittente: string | null
  oggetto_mail: string | null
  importo: number | null
  numero_documento: string | null
  ocr_tipo: string | null
  ocr_ragione_sociale: string | null
  ocr_p_iva: string | null
  matched_by: string | null
  giorni_in_stato: number | null
  priorita: number
}

export interface AiSuggestion {
  azione_id: CommandId
  label: string
  confidenza: number
  totali_conferme: number
  match_tipo: 'esatto' | 'generico'
  /** Se true, la confidenza è ≥95% e ci sono ≥10 conferme → esecuzione automatica. */
  autoEsegui?: boolean
}

export interface CommandContext {
  item: CodaItem
  sedeId: string | null
  userId?: string
}

export type CommandPredicate = (ctx: CommandContext) => boolean | Promise<boolean>

export type CommandExecutor = (ctx: CommandContext) => Promise<{
  success: boolean
  message?: string
  error?: string
}>

export interface Command {
  id: CommandId
  label: string
  descrizione: string
  gruppo: CommandGroup
  icona: string
  shortcut?: string
  predicato: CommandPredicate
  esegui: CommandExecutor
}

export interface CommandGroupInfo {
  id: CommandGroup
  label: string
  ordine: number
}
