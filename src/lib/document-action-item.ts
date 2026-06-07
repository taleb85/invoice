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

export function documentActionItemFromAnomalieRow(
  row: {
    fileUrl?: string | null
    numero?: string | null
    data?: string | null
    importo?: number | null
    meta?: {
      fatturaId?: string
      bollaId?: string
      statementId?: string
      documentoId?: string
    } | null
  },
  fornitoreId: string,
  fornitoreNome: string,
): DocumentActionItem | null {
  const url = row.fileUrl?.trim() || null
  if (!url) return null
  if (row.meta?.fatturaId) {
    return documentActionItemForFattura(
      {
        id: row.meta.fatturaId,
        fornitore_id: fornitoreId,
        numero_fattura: row.numero,
        file_url: url,
        data: row.data,
        importo: row.importo,
      },
      fornitoreId,
      fornitoreNome,
    )
  }
  if (row.meta?.bollaId) {
    return documentActionItemForBolla(
      {
        id: row.meta.bollaId,
        numero_bolla: row.numero,
        file_url: url,
        data: row.data,
      },
      fornitoreId,
      fornitoreNome,
    )
  }
  if (row.meta?.statementId) {
    return {
      id: row.meta.statementId,
      origine: 'riga_statement',
      fornitore_id: fornitoreId,
      fornitore_nome: fornitoreNome,
      file_url: url,
      data_doc: row.data ?? null,
      importo: row.importo ?? null,
    }
  }
  if (row.meta?.documentoId) {
    return documentActionItemForPendingDoc(
      { id: row.meta.documentoId, fornitore_id: fornitoreId, file_url: url },
      fornitoreNome,
    )
  }
  return null
}

export function documentActionItemForBolla(
  b: {
    id: string
    sede_id?: string | null
    numero_bolla?: string | null
    file_url?: string | null
    data?: string | null
  },
  fornitoreId: string,
  fornitoreNome: string,
): DocumentActionItem {
  return {
    id: b.id,
    origine: 'bolla',
    fornitore_id: fornitoreId,
    fornitore_nome: fornitoreNome,
    sede_id: b.sede_id ?? null,
    numero_documento: b.numero_bolla ?? null,
    file_url: b.file_url ?? null,
    data_doc: b.data ?? null,
  }
}

export function documentActionItemForFattura(
  f: {
    id: string
    fornitore_id?: string | null
    sede_id?: string | null
    numero_fattura?: string | null
    file_url?: string | null
    data?: string | null
    importo?: number | null
  },
  fornitoreId: string,
  fornitoreNome: string,
): DocumentActionItem {
  return {
    id: f.id,
    origine: 'fattura',
    fornitore_id: f.fornitore_id ?? fornitoreId,
    fornitore_nome: fornitoreNome,
    sede_id: f.sede_id ?? null,
    numero_documento: f.numero_fattura ?? null,
    file_url: f.file_url ?? null,
    data_doc: f.data ?? null,
    importo: f.importo ?? null,
  }
}

export function documentActionItemForPendingDoc(
  doc: {
    id: string
    fornitore_id?: string | null
    sede_id?: string | null
    file_url?: string | null
    mittente?: string | null
    oggetto_mail?: string | null
    pending_kind?: string
  },
  fornitoreNome?: string | null,
): DocumentActionItem {
  return {
    id: doc.id,
    origine: 'documento_da_processare',
    fornitore_id: doc.fornitore_id ?? null,
    fornitore_nome: fornitoreNome ?? null,
    sede_id: doc.sede_id ?? null,
    file_url: doc.file_url ?? null,
    mittente: doc.mittente ?? null,
    oggetto_mail: doc.oggetto_mail ?? null,
    pending_kind: doc.pending_kind,
  }
}
