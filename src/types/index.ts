export interface Sede {
  id: string
  nome: string
  created_at: string
}

export interface Profile {
  id: string
  email: string | null
  sede_id: string | null
  role: 'admin' | 'operatore'
  full_name: string | null
  created_at: string
  sedi?: Sede | null
}

export interface Fornitore {
  id: string
  sede_id: string | null
  nome: string
  email: string | null
  piva: string | null
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
