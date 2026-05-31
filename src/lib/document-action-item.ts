import type { DocumentActionItem } from '@/components/DocumentActionsModal'

/** Costruisce l’item per `DocumentActionsModal` da id entità nota. */
export function documentActionItemFromEntity(p: {
  fatturaId?: string | null
  bollaId?: string | null
  documentoId?: string | null
  statementId?: string | null
  fileUrl?: string | null
  fornitoreId?: string | null
  fornitoreNome?: string | null
  sedeId?: string | null
  numeroDocumento?: string | null
  dataDoc?: string | null
  importo?: number | null
}): DocumentActionItem | null {
  const url = p.fileUrl?.trim() || null
  const f = p.fatturaId?.trim()
  if (f) {
    return {
      id: f,
      origine: 'fattura',
      fornitore_id: p.fornitoreId ?? null,
      fornitore_nome: p.fornitoreNome ?? null,
      sede_id: p.sedeId ?? null,
      numero_documento: p.numeroDocumento ?? null,
      file_url: url,
      data_doc: p.dataDoc ?? null,
      importo: p.importo ?? null,
    }
  }
  const b = p.bollaId?.trim()
  if (b) {
    return {
      id: b,
      origine: 'bolla',
      fornitore_id: p.fornitoreId ?? null,
      fornitore_nome: p.fornitoreNome ?? null,
      sede_id: p.sedeId ?? null,
      numero_documento: p.numeroDocumento ?? null,
      file_url: url,
      data_doc: p.dataDoc ?? null,
      importo: p.importo ?? null,
    }
  }
  const d = p.documentoId?.trim()
  if (d) {
    return {
      id: d,
      origine: 'documento_da_processare',
      fornitore_id: p.fornitoreId ?? null,
      fornitore_nome: p.fornitoreNome ?? null,
      sede_id: p.sedeId ?? null,
      numero_documento: p.numeroDocumento ?? null,
      file_url: url,
      data_doc: p.dataDoc ?? null,
      importo: p.importo ?? null,
      mittente: null,
      oggetto_mail: null,
    }
  }
  const s = p.statementId?.trim()
  if (s) {
    return {
      id: s,
      origine: 'riga_statement',
      fornitore_id: p.fornitoreId ?? null,
      fornitore_nome: p.fornitoreNome ?? null,
      file_url: url,
      data_doc: p.dataDoc ?? null,
      importo: p.importo ?? null,
    }
  }
  return null
}
