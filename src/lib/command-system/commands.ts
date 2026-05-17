import type { Command, CommandContext } from './types'
import { registraComandiMulti } from './registry'

function isDocumento(ctx: CommandContext) {
  return ctx.item.origine === 'documento_da_processare' || ctx.item.origine === 'riga_statement'
}

function isStatement(ctx: CommandContext) {
  return ctx.item.origine === 'riga_statement'
}

function isFattura(ctx: CommandContext) {
  return ctx.item.origine === 'fattura'
}

function hasFornitore(ctx: CommandContext) {
  return !!ctx.item.fornitore_id
}

async function callApi(url: string, body: Record<string, unknown>): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.error || `Errore ${res.status}` }
    return { success: true, message: data.message || 'Operazione completata' }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Errore di rete' }
  }
}

const COMANDI_DOCUMENTO: Command[] = [
  {
    id: 'documento.scarta',
    label: 'Scarta documento',
    descrizione: 'Elimina il documento dalla coda senza registrarlo',
    gruppo: 'documento',
    icona: 'Trash2',
    shortcut: 'Backspace',
    predicato: (ctx) => ctx.item.origine === 'documento_da_processare' && ctx.item.stato_origine !== 'scartato',
    esegui: (ctx) => callApi('/api/documenti-da-processare', {
      id: ctx.item.id,
      azione: 'scarta',
    }),
  },
  {
    id: 'documento.associa',
    label: 'Associa a fornitore',
    descrizione: 'Apri associazione fornitore per questo documento',
    gruppo: 'documento',
    icona: 'UserPlus',
    predicato: (ctx) => ctx.item.origine === 'documento_da_processare' && !hasFornitore(ctx),
    esegui: async (_ctx) => ({ success: true, message: 'Apri dialogo associazione' }),
  },
  {
    id: 'documento.finalizza_come_fattura',
    label: 'Registra come fattura',
    descrizione: 'Crea una fattura a partire dal documento',
    gruppo: 'documento',
    icona: 'FileText',
    predicato: (ctx) => ctx.item.origine === 'documento_da_processare',
    esegui: (ctx) => {
      return callApi('/api/documenti-da-processare', {
        id: ctx.item.id,
        azione: 'finalizza_tipo',
        kind: 'fattura',
      })
    },
  },
  {
    id: 'documento.finalizza_come_bolla',
    label: 'Registra come bolla',
    descrizione: 'Crea una bolla di consegna a partire dal documento',
    gruppo: 'documento',
    icona: 'Package',
    predicato: (ctx) => ctx.item.origine === 'documento_da_processare',
    esegui: (ctx) => callApi('/api/documenti-da-processare', {
      id: ctx.item.id,
      azione: 'finalizza_tipo',
      kind: 'bolla',
    }),
  },
  {
    id: 'documento.finalizza_come_nota_credito',
    label: 'Registra come nota di credito',
    descrizione: 'Crea una nota di credito a partire dal documento',
    gruppo: 'documento',
    icona: 'Undo',
    predicato: (ctx) => ctx.item.origine === 'documento_da_processare',
    esegui: (ctx) => callApi('/api/documenti-da-processare', {
      id: ctx.item.id,
      azione: 'finalizza_tipo',
      kind: 'nota_credito',
    }),
  },
  {
    id: 'documento.finalizza_come_statement',
    label: 'Archivia come estratto conto',
    descrizione: 'Archivia il documento come estratto conto / statement',
    gruppo: 'documento',
    icona: 'FileSpreadsheet',
    predicato: (ctx) => ctx.item.origine === 'documento_da_processare',
    esegui: (ctx) => callApi('/api/documenti-da-processare', {
      id: ctx.item.id,
      azione: 'finalizza_tipo',
      kind: 'statement',
    }),
  },
  {
    id: 'documento.finalizza_come_ordine',
    label: 'Registra come ordine',
    descrizione: 'Crea un ordine / conferma ordine a partire dal documento',
    gruppo: 'documento',
    icona: 'ShoppingCart',
    predicato: (ctx) => ctx.item.origine === 'documento_da_processare',
    esegui: (ctx) => callApi('/api/documenti-da-processare', {
      id: ctx.item.id,
      azione: 'finalizza_tipo',
      kind: 'ordine',
    }),
  },
  {
    id: 'documento.finalizza_come_comunicazione',
    label: 'Archivia come comunicazione',
    descrizione: 'Marca il documento come comunicazione (non fiscale)',
    gruppo: 'documento',
    icona: 'MessageSquare',
    predicato: (ctx) => ctx.item.origine === 'documento_da_processare',
    esegui: (ctx) => callApi('/api/documenti-da-processare', {
      id: ctx.item.id,
      azione: 'finalizza_tipo',
      kind: 'comunicazione',
    }),
  },
  {
    id: 'documento.rianalizza_ocr',
    label: 'Rianalizza con OCR',
    descrizione: 'Invia nuovamente il documento all\'analisi OCR',
    gruppo: 'documento',
    icona: 'RefreshCw',
    predicato: (ctx) => ctx.item.origine === 'documento_da_processare',
    esegui: (ctx) => callApi('/api/documenti-da-processare', {
      id: ctx.item.id,
      azione: 'rianalizza_ocr',
    }),
  },
  {
    id: 'documento.ignora_mittente',
    label: 'Ignora mittente',
    descrizione: 'Aggiunge il mittente alla blacklist e scarta il documento',
    gruppo: 'documento',
    icona: 'Ban',
    predicato: (ctx) => ctx.item.origine === 'documento_da_processare',
    esegui: (ctx) => callApi('/api/documenti-da-processare', {
      id: ctx.item.id,
      azione: 'ignora_mittente',
    }),
  },
  {
    id: 'documento.apri',
    label: 'Apri documento',
    descrizione: 'Visualizza il documento allegato',
    gruppo: 'generale',
    icona: 'ExternalLink',
    predicato: () => true,
    esegui: (ctx) => callApi('/api/open-document', { documentoId: ctx.item.id }),
  },
  {
    id: 'documento.aggiorna_categoria',
    label: 'Cambia categoria',
    descrizione: 'Modifica la categoria del documento (fiscale/non fiscale)',
    gruppo: 'documento',
    icona: 'Tag',
    predicato: (ctx) => ctx.item.origine === 'documento_da_processare',
    esegui: async (_ctx) => ({ success: true, message: 'Apri dialogo categoria' }),
  },
]

const COMANDI_FATTURA: Command[] = [
  {
    id: 'fattura.approva',
    label: 'Approva fattura',
    descrizione: 'Approva la fattura per il pagamento',
    gruppo: 'fattura',
    icona: 'CheckCircle',
    predicato: (ctx) => isFattura(ctx) && ctx.item.stato_origine === 'pending',
    esegui: async (ctx) => {
      const res = await fetch(`/api/fatture/${ctx.item.id}/approva`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return { success: false, error: data.error || `Errore ${res.status}` }
      }
      return { success: true, message: 'Fattura approvata' }
    },
  },
  {
    id: 'fattura.rifiuta',
    label: 'Rifiuta fattura',
    descrizione: 'Rifiuta la fattura con motivazione',
    gruppo: 'fattura',
    icona: 'XCircle',
    predicato: (ctx) => isFattura(ctx) && ctx.item.stato_origine === 'pending',
    esegui: async (_ctx) => ({ success: true, message: 'Apri dialogo rifiuto' }),
  },
  {
    id: 'fattura.resetta_approvazione',
    label: 'Resetta approvazione',
    descrizione: 'Torna allo stato pending per riesaminare',
    gruppo: 'fattura',
    icona: 'RotateCcw',
    predicato: (ctx) => isFattura(ctx) && ctx.item.stato_origine === 'approved',
    esegui: async (ctx) => {
      const res = await fetch(`/api/fatture/${ctx.item.id}/resetta-approvazione`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return { success: false, error: data.error || `Errore ${res.status}` }
      }
      return { success: true, message: 'Approvazione resettata' }
    },
  },
]

const COMANDI_STATEMENT: Command[] = [
  {
    id: 'statement.segna_come_ok',
    label: 'Segna come verificato',
    descrizione: 'Marca la riga estratto conto come verificata (OK)',
    gruppo: 'statement',
    icona: 'Check',
    predicato: (ctx) => isStatement(ctx) && ctx.item.stato_origine !== 'ok',
    esegui: (ctx) => callApi('/api/statements/update-row-status', {
      rowId: ctx.item.id,
      status: 'ok',
    }),
  },
  {
    id: 'statement.assegna_fattura',
    label: 'Assegna fattura',
    descrizione: 'Collega una fattura esistente a questa riga',
    gruppo: 'statement',
    icona: 'Link',
    predicato: (ctx) => isStatement(ctx) && ctx.item.stato_origine !== 'ok',
    esegui: async (_ctx) => ({ success: true, message: 'Apri dialogo selezione fattura' }),
  },
  {
    id: 'statement.associa_fornitore',
    label: 'Associa a fornitore',
    descrizione: 'Cambia il fornitore associato a questa riga estratto conto',
    gruppo: 'statement',
    icona: 'UserPlus',
    predicato: (ctx) => isStatement(ctx),
    esegui: async (_ctx) => ({ success: true, message: 'Apri dialogo associazione' }),
  },
]

export function inizializzaComandi(): void {
  registraComandiMulti(
    ...COMANDI_DOCUMENTO,
    ...COMANDI_FATTURA,
    ...COMANDI_STATEMENT,
  )
}
