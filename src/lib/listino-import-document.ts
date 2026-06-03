/** Tipi documento da cui si estrae il listino (fatture, bolle, conferme ordine). */
export type ListinoImportDocTipo = 'fattura' | 'bolla' | 'ordine'

export function listinoImportApiBody(
  tipo: ListinoImportDocTipo,
  id: string,
): Record<string, string> {
  switch (tipo) {
    case 'fattura':
      return { fattura_id: id }
    case 'bolla':
      return { bolla_id: id }
    case 'ordine':
      return { conferma_ordine_id: id }
  }
}

export function listinoImportTable(
  tipo: ListinoImportDocTipo,
): 'fatture' | 'bolle' | 'conferme_ordine' {
  switch (tipo) {
    case 'fattura':
      return 'fatture'
    case 'bolla':
      return 'bolle'
    case 'ordine':
      return 'conferme_ordine'
  }
}
