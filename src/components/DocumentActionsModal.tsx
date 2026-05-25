'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  UserCheck,
  Tag,
  FileText,
  RotateCw,
  Ban,
  CheckCircle,
  Trash2,
  ExternalLink,
  Save,
  Archive,
  ShoppingCart,
  Package,
  CreditCard,
  MessageSquare,
  List,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react'
import type { CommandId } from '@/lib/command-system/types'

export type DocumentActionItem = {
  id: string
  origine: string
  fornitore_id?: string | null
  fornitore_nome?: string | null
  sede_id?: string | null
  numero_documento?: string | null
  file_url?: string | null
  pending_kind?: string
  importo?: number | null
  mittente?: string | null
  oggetto_mail?: string | null
  data_doc?: string | null
}

export type DocumentAction = {
  id: CommandId
  label: string
  descrizione: string
  icona: React.ReactNode
  gruppo: 'tipo' | 'fornitore' | 'stato' | 'documento' | 'pericolose'
  pericolosa?: boolean
  /** Solo per certi origini documento */
  origini?: string[]
}

// ─── Azioni complete per ogni tipo di documento ──────────────────────────────

const ALL_ACTIONS: DocumentAction[] = [
  // ── Tipo documento ──
  { id: 'documento.finalizza_come_fattura', label: 'Registra come fattura', descrizione: 'Crea una fattura definitiva', icona: <FileText className="h-4 w-4" />, gruppo: 'tipo', origini: ['documento_da_processare'] },
  { id: 'documento.finalizza_come_bolla', label: 'Registra come bolla/DDT', descrizione: 'Crea un documento di trasporto', icona: <Package className="h-4 w-4" />, gruppo: 'tipo', origini: ['documento_da_processare'] },
  { id: 'documento.finalizza_come_nota_credito', label: 'Registra come nota di credito', descrizione: 'Nota di credito', icona: <CreditCard className="h-4 w-4" />, gruppo: 'tipo', origini: ['documento_da_processare'] },
  { id: 'documento.finalizza_come_statement', label: 'Archivia come estratto conto', descrizione: 'Estratto conto da riconciliare', icona: <List className="h-4 w-4" />, gruppo: 'tipo', origini: ['documento_da_processare'] },
  { id: 'documento.finalizza_come_ordine', label: 'Registra come ordine', descrizione: 'Ordine d\'acquisto', icona: <ShoppingCart className="h-4 w-4" />, gruppo: 'tipo', origini: ['documento_da_processare'] },
  { id: 'documento.finalizza_come_comunicazione', label: 'Archivia come comunicazione', descrizione: 'Documento non fiscale', icona: <MessageSquare className="h-4 w-4" />, gruppo: 'tipo', origini: ['documento_da_processare'] },
  { id: 'documento.finalizza_come_listino', label: 'Registra come listino', descrizione: 'Listino prezzi', icona: <List className="h-4 w-4" />, gruppo: 'tipo', origini: ['documento_da_processare'] },
  // ── Fornitore ──
  { id: 'documento.associa', label: 'Associa a fornitore', descrizione: 'Collega un fornitore esistente', icona: <UserCheck className="h-4 w-4" />, gruppo: 'fornitore' },
  // Limited to documenti_da_processare: the underlying API (`/api/documenti-da-processare`)
  // only works on rows in that table. For already-registered bolle/fatture the dedicated
  // actions `bolla.converti_in_fattura` / `documento.finalizza_come_nota_credito` (handled
  // via `/api/fatture/update-type`) are used instead, plus the inline tipo dropdown on the
  // supplier ledger rows for finer corrections.
  { id: 'documento.aggiorna_categoria', label: 'Cambia categoria', descrizione: 'Modifica il tipo documento (AI impara dalla correzione)', icona: <Tag className="h-4 w-4" />, gruppo: 'fornitore', origini: ['documento_da_processare'] },
  // ── Stato ──
  { id: 'documento.scarta', label: 'Scarta documento', descrizione: 'Rimuove dalla coda come scartato', icona: <Ban className="h-4 w-4" />, gruppo: 'stato', pericolosa: true, origini: ['documento_da_processare'] },
  { id: 'documento.scarta_fattura', label: 'Scarta fattura', descrizione: 'Segna come scartata / non valida', icona: <Ban className="h-4 w-4" />, gruppo: 'stato', pericolosa: true, origini: ['fattura'] },
  { id: 'documento.rianalizza_ocr', label: 'Rianalizza con OCR', descrizione: 'Richiama Gemini per ri-estrarre i dati', icona: <RotateCw className="h-4 w-4" />, gruppo: 'stato', origini: ['documento_da_processare'] },
  { id: 'documento.ignora_mittente', label: 'Ignora mittente', descrizione: 'Aggiungi alla blacklist', icona: <Ban className="h-4 w-4" />, gruppo: 'stato', pericolosa: true, origini: ['documento_da_processare'] },
  { id: 'fattura.approva', label: 'Approva fattura', descrizione: 'Conferma e finalizza', icona: <CheckCircle className="h-4 w-4" />, gruppo: 'stato', origini: ['fattura'] },
  { id: 'fattura.rifiuta', label: 'Rifiuta fattura', descrizione: 'Respingi con motivazione', icona: <AlertTriangle className="h-4 w-4" />, gruppo: 'stato', pericolosa: true, origini: ['fattura'] },
  { id: 'fattura.resetta_approvazione', label: 'Resetta approvazione', descrizione: 'Torna in attesa', icona: <RotateCw className="h-4 w-4" />, gruppo: 'stato', origini: ['fattura'] },
  { id: 'statement.segna_come_ok', label: 'Segna come verificato', descrizione: 'Conferma riga estratto conto', icona: <CheckCircle className="h-4 w-4" />, gruppo: 'stato', origini: ['riga_statement'] },
  { id: 'statement.assegna_fattura', label: 'Assegna fattura a riga', descrizione: 'Collega una fattura esistente', icona: <FileText className="h-4 w-4" />, gruppo: 'stato', origini: ['riga_statement'] },
  // ── Documento ──
  { id: 'documento.apri', label: 'Apri documento', descrizione: 'Visualizza il file originale', icona: <ExternalLink className="h-4 w-4" />, gruppo: 'documento' },
  // ── Bolla ──
  { id: 'bolla.rianalizza_ocr', label: 'Rianalizza con OCR', descrizione: 'Ri-estrai dati con Gemini e aggiorna il documento', icona: <RotateCw className="h-4 w-4" />, gruppo: 'stato', origini: ['bolla'] },
  { id: 'bolla.converti_in_fattura', label: 'Converti in fattura', descrizione: 'Trasforma questa bolla in una fattura registrata', icona: <Save className="h-4 w-4" />, gruppo: 'tipo', origini: ['bolla'] },
  { id: 'bolla.cambia_fornitore', label: 'Cambia fornitore', descrizione: 'Riassegna a un fornitore diverso', icona: <UserCheck className="h-4 w-4" />, gruppo: 'fornitore', origini: ['bolla'] },
  { id: 'bolla.elimina', label: 'Elimina bolla', descrizione: 'Rimuove definitivamente il documento', icona: <Archive className="h-4 w-4" />, gruppo: 'pericolose', pericolosa: true, origini: ['bolla'] },
]

type DocumentActionsModalProps = {
  open: boolean
  item: DocumentActionItem | null
  onClose: () => void
  onExecute: (item: DocumentActionItem, actionId: CommandId) => Promise<void>
  eseguendoId?: string | null
}

export default function DocumentActionsModal({
  open,
  item,
  onClose,
  onExecute,
  eseguendoId,
}: DocumentActionsModalProps) {
  const [confermaId, setConfermaId] = useState<string | null>(null)
  const [selettoreCategoria, setSelettoreCategoria] = useState(false)

  if (!open || !item) return null

  const visible = ALL_ACTIONS.filter(
    (a) => !a.origini || a.origini.some((o) => o === item.origine),
  )
  const isLoading = (id: string) => eseguendoId === `${item.id}_${id}`
  const inConferma = (id: string) => confermaId === id

  const handleClick = async (action: DocumentAction) => {
    // "Cambia categoria" apre il selettore inline
    if (action.id === 'documento.aggiorna_categoria') {
      setSelettoreCategoria(true)
      return
    }
    if (action.pericolosa && !inConferma(action.id)) {
      setConfermaId(action.id)
      return
    }
    setConfermaId(null)
    await onExecute(item, action.id)
    onClose()
  }

  const CATEGORY_OPTIONS: { id: CommandId; label: string; icona: React.ReactNode }[] = [
    { id: 'documento.finalizza_come_fattura', label: 'Fattura', icona: <FileText className="h-4 w-4" /> },
    { id: 'documento.finalizza_come_bolla', label: 'Bolla / DDT', icona: <Package className="h-4 w-4" /> },
    { id: 'documento.finalizza_come_nota_credito', label: 'Nota di credito', icona: <CreditCard className="h-4 w-4" /> },
    { id: 'documento.finalizza_come_statement', label: 'Estratto conto', icona: <List className="h-4 w-4" /> },
    { id: 'documento.finalizza_come_ordine', label: 'Ordine', icona: <ShoppingCart className="h-4 w-4" /> },
    { id: 'documento.finalizza_come_comunicazione', label: 'Comunicazione', icona: <MessageSquare className="h-4 w-4" /> },
    { id: 'documento.finalizza_come_listino', label: 'Listino', icona: <List className="h-4 w-4" /> },
  ]

  const handleCategorySelect = async (id: CommandId) => {
    setSelettoreCategoria(false)
    await onExecute(item, id)
    onClose()
  }

  const gruppi = ['tipo', 'fornitore', 'stato', 'documento', 'pericolose'] as const
  const etichette: Record<string, string> = {
    tipo: 'Tipo documento',
    fornitore: 'Fornitore e categoria',
    stato: 'Stato e azioni',
    documento: 'Documento',
    pericolose: 'Azioni pericolose',
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-xl border border-app-line-28 bg-app-bg shadow-2xl shadow-black/20">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-app-line-28 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-app-fg">Azioni documento</p>
            <p className="mt-0.5 truncate text-[11px] text-app-fg-muted">
              {item.fornitore_nome ?? 'Senza fornitore'}
              {item.numero_documento && ` · ${item.numero_documento}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-2 rounded-lg p-1.5 text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corpo azioni */}
        {selettoreCategoria ? (
          <div className="px-3 py-4">
            <div className="mb-3 flex items-center gap-2 px-2">
              <button
                type="button"
                onClick={() => setSelettoreCategoria(false)}
                className="rounded p-1 text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <p className="text-xs font-semibold text-app-fg">Seleziona il tipo corretto</p>
            </div>
            <p className="mb-3 px-2 text-[11px] text-app-fg-muted">
              La correzione verrà registrata per addestrare l'AI a non ripetere l'errore.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleCategorySelect(opt.id)}
                  disabled={isLoading(opt.id)}
                  className="flex items-center gap-2.5 rounded-lg border border-app-line-28 bg-app-line-5 px-3 py-3 text-left transition-colors hover:bg-cyan-500/10 hover:border-cyan-500/30 disabled:opacity-40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                    {isLoading(opt.id) ? (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      opt.icona
                    )}
                  </span>
                  <span className="text-xs font-semibold text-app-fg">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
        <div className="max-h-[60vh] overflow-y-auto px-3 py-3">
          {gruppi.map((grp) => {
            const azioni = visible.filter((a) => a.gruppo === grp)
            if (!azioni.length) return null
            return (
              <div key={grp} className="mb-3 last:mb-0">
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-app-fg-muted">
                  {etichette[grp] ?? grp}
                </p>
                <div className="space-y-0.5">
                  {azioni.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleClick(action)}
                      disabled={isLoading(action.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        action.pericolosa
                          ? 'hover:bg-rose-500/10 active:bg-rose-500/15'
                          : 'hover:bg-app-line-10 active:bg-app-line-18'
                      } disabled:opacity-40`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                          action.pericolosa
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-cyan-500/10 text-cyan-400'
                        }`}
                      >
                        {isLoading(action.id) ? (
                          <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          action.icona
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-semibold ${
                            action.pericolosa ? 'text-rose-300' : 'text-app-fg'
                          }`}
                        >
                          {inConferma(action.id) ? `Confermi? (${action.label})` : action.label}
                        </p>
                        {!inConferma(action.id) && (
                          <p className="mt-0.5 text-[11px] text-app-fg-muted">{action.descrizione}</p>
                        )}
                        {inConferma(action.id) && (
                          <p className="mt-0.5 text-[11px] text-rose-400">Clicca di nuovo per confermare</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        )}

        {/* Footer */}
        <div className="border-t border-app-line-28 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-app-line-28 px-4 py-2 text-xs font-semibold text-app-fg transition-colors hover:bg-app-line-10"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
