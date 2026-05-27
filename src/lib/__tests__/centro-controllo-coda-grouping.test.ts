import { describe, expect, it } from 'vitest'
import {
  buildCodaDisplayEntries,
  countStatementRowsByStatus,
  getStatementIdFromCodaItem,
  worstPrioritaInGroup,
} from '@/lib/centro-controllo-coda-grouping'
import type { CodaItem } from '@/lib/command-system/types'

function stmtRow(id: string, statementId: string, priorita = 2): CodaItem {
  return {
    id,
    origine: 'riga_statement',
    stato_origine: 'fattura_mancante',
    pending_kind: 'statement',
    fornitore_id: 'f1',
    fornitore_nome: 'Test',
    sede_id: 's1',
    riferimenti: id,
    nome_file: null,
    data_doc: '2026-05-06',
    data_inserimento: '2026-05-25T10:00:00Z',
    file_url: null,
    contesto_originale: { statement_id: statementId },
    mittente: null,
    oggetto_mail: null,
    importo: 100,
    numero_documento: id,
    ocr_tipo: null,
    ocr_ragione_sociale: null,
    ocr_p_iva: null,
    matched_by: null,
    giorni_in_stato: null,
    priorita,
  }
}

function docItem(id: string): CodaItem {
  return {
    ...stmtRow(id, 'unused'),
    origine: 'documento_da_processare',
    contesto_originale: null,
    priorita: 4,
  }
}

describe('buildCodaDisplayEntries', () => {
  it('groups 2+ statement rows with same statement_id', () => {
    const items = [stmtRow('a', 'st1'), stmtRow('b', 'st1'), docItem('d1')]
    const entries = buildCodaDisplayEntries(items)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({ type: 'statement_group', statementId: 'st1' })
    expect(entries[0].type === 'statement_group' && entries[0].items).toHaveLength(2)
    expect(entries[1]).toMatchObject({ type: 'item', item: { id: 'd1' } })
  })

  it('keeps single statement row ungrouped', () => {
    const items = [stmtRow('a', 'st1'), stmtRow('b', 'st2')]
    const entries = buildCodaDisplayEntries(items)
    expect(entries).toHaveLength(2)
    expect(entries.every((e) => e.type === 'item')).toBe(true)
  })

  it('preserves first-occurrence order for groups', () => {
    const items = [docItem('d1'), stmtRow('a', 'st1'), stmtRow('b', 'st1')]
    const entries = buildCodaDisplayEntries(items)
    expect(entries[0].type).toBe('item')
    expect(entries[1].type).toBe('statement_group')
  })
})

describe('getStatementIdFromCodaItem', () => {
  it('returns null for non-statement items', () => {
    expect(getStatementIdFromCodaItem(docItem('x'))).toBeNull()
  })
})

describe('countStatementRowsByStatus', () => {
  it('aggregates check_status from stato_origine', () => {
    const items = [
      { ...stmtRow('1', 'st'), stato_origine: 'fattura_mancante' },
      { ...stmtRow('2', 'st'), stato_origine: 'errore_importo' },
      { ...stmtRow('3', 'st'), stato_origine: 'fattura_mancante' },
    ]
    expect(countStatementRowsByStatus(items)).toEqual({
      fattura_mancante: 2,
      errore_importo: 1,
    })
  })
})

describe('worstPrioritaInGroup', () => {
  it('returns minimum priorita (most urgent)', () => {
    expect(worstPrioritaInGroup([stmtRow('a', 'st', 3), stmtRow('b', 'st', 1)])).toBe(1)
  })
})
