export interface Sede {
  id: string
  nome: string
  created_at: string
}

export interface Profile {
  id: string
  email: string | null
  sede_id: string | null
  role: 'admin' | 'admin_sede' | 'operatore'
  full_name: string | null
  created_at: string
  sedi?: Sede | null
}

export interface Fornitore {
  id: string
  sede_id: string | null
  nome: string
  /** Nome breve opzionale per UI compatte (barra mobile, elenchi). */
  display_name?: string | null
  email: string | null
  piva: string | null
  /** ID fornitore su Rekki (mapping / confronto listino). */
  rekki_supplier_id?: string | null
  /** Link profilo / ordine Rekki (opzionale). */
  rekki_link?: string | null
  created_at: string
}

export type BollaStato = 'in attesa' | 'completato'

export interface Bolla {
  id: string
  sede_id: string | null
  fornitore_id: string
  fornitore?: Fornitore
  data: string
  file_url: string | null
  stato: BollaStato
  created_at: string
}

export interface Fattura {
  id: string
  sede_id: string | null
  fornitore_id: string
  fornitore?: Fornitore
  bolla_id: string | null
  bolla?: Bolla
  data: string
  file_url: string | null
  created_at: string
}
