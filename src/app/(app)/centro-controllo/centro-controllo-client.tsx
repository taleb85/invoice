'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useT } from '@/lib/use-t'
import { useToast } from '@/lib/toast-context'
import {
  AlertCircle,
  Brain,
  CheckCircle,
  ExternalLink,
  FileText,
  Loader2,
  Search,
  X,
  Zap,
} from 'lucide-react'
import { GlyphCheck } from '@/components/ui/glyph-icons'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { INITIALIZE_COMMANDS } from '@/lib/command-system/init'
import type { CodaItem, AiSuggestion, CommandId, Command } from '@/lib/command-system/types'
import {
  tuttiComandi,
  getComando,
  comandiApplicabili,
} from '@/lib/command-system/registry'
import { suggerisciAzione, registraConfermaApprendimento, registraEsecuzioneDiretta } from '@/lib/action-learning/engine'
import { formattaPriorita, labelPendingKind } from '@/lib/command-system/utils'
import AssociaFornitoreDialog from './_dialogs/associa-fornitore-dialog'
import AggiornaCategoriaDialog from './_dialogs/aggiorna-categoria-dialog'
import RifiutaFatturaDialog from './_dialogs/rifiuta-fattura-dialog'
import AssegnaFatturaDialog from './_dialogs/assegna-fattura-dialog'

INITIALIZE_COMMANDS()

interface Props {
  sedeId: string | null
  isMasterAdmin: boolean
}

type FiltroOrigine = 'tutti' | 'documento_da_processare' | 'riga_statement' | 'fattura' | 'errore_sincronizzazione' | 'bolla_aperta'

export default function CentroControlloClient({ sedeId, isMasterAdmin }: Props) {
  const t = useT()
  const { showToast } = useToast()

  const [items, setItems] = useState<CodaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtroOrigine, setFiltroOrigine] = useState<FiltroOrigine>('tutti')
  const [suggerimenti, setSuggerimenti] = useState<Map<string, AiSuggestion>>(new Map())
  const [eseguendoId, setEseguendoId] = useState<string | null>(null)
  const [cmdPaletteAperta, setCmdPaletteAperta] = useState(false)
  const [ricercaCmd, setRicercaCmd] = useState('')
  const [autoResolving, setAutoResolving] = useState(false)
  const [associatiStats, setAssociatiStats] = useState<{ totale: number; con_anomalie: number; anomalie_totali: number } | null>(null)
  const [associatiDocs, setAssociatiDocs] = useState<unknown[]>([])
  const [associatiOpen, setAssociatiOpen] = useState(false)

  type DialogType = 'associa' | 'categoria' | 'rifiuta_fattura' | 'assegna_fattura'
  const [dialogAperto, setDialogAperto] = useState<{ tipo: DialogType; item: CodaItem } | null>(null)

  const caricaCoda = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (sedeId) params.set('sede_id', sedeId)
      const res = await fetch(`/api/centro-controllo/coda?${params}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Errore ${res.status}`)
      }
      const data = await res.json()
      setItems(data.items || [])

      const suggMap = new Map<string, AiSuggestion>()
      for (const item of (data.items || []) as CodaItem[]) {
        const sugg = await suggerisciAzione(item)
        if (!sugg) continue

        if (sugg.autoEsegui) {
          const cmd = getComando(sugg.azione_id)
          if (cmd) {
            const result = await cmd.esegui({ item, sedeId })
            if (result.success) {
              await registraEsecuzioneDiretta(item, sugg.azione_id)
              showToast(`⚡ ${sugg.label} — eseguito automaticamente (confidenza ${(sugg.confidenza * 100).toFixed(0)}%)`, 'success')
            } else {
              showToast(`Auto-esecuzione fallita: ${result.error || 'Errore'}`, 'error')
              suggMap.set(item.id, sugg)
            }
          }
        } else {
          suggMap.set(item.id, sugg)
        }
      }
      setSuggerimenti(suggMap)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento coda')
    } finally {
      setLoading(false)
    }
  }, [sedeId])

  const caricaAssociati = useCallback(async () => {
    const params = new URLSearchParams()
    if (sedeId) params.set('sede_id', sedeId)
    params.set('report', 'true')
    try {
      const res2 = await fetch(`/api/documenti-associati?${params}`)
      if (res2.ok) {
        const data2 = await res2.json()
        if (data2.success) {
          setAssociatiStats({
            totale: data2.statistiche?.totale ?? 0,
            con_anomalie: data2.statistiche?.totale_con_anomalie ?? 0,
            anomalie_totali: data2.statistiche?.anomalie?.totali ?? 0,
          })
        }
      }
      const paramsList = new URLSearchParams()
      if (sedeId) paramsList.set('sede_id', sedeId)
      paramsList.set('limit', '50')
      paramsList.set('anomalie_only', 'true')
      const res3 = await fetch(`/api/documenti-associati?${paramsList}`)
      if (res3.ok) {
        const data3 = await res3.json()
        if (data3.success && data3.data?.length) {
          setAssociatiDocs(data3.data.slice(0, 50))
        }
      }
    } catch { /* non-critical */ }
  }, [sedeId])

  useEffect(() => {
    caricaCoda()
    caricaAssociati()
  }, [caricaCoda, caricaAssociati])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCmdPaletteAperta((v) => !v)
      }
      if (e.key === 'Escape') {
        setCmdPaletteAperta(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const itemsFiltrati = useMemo(() => {
    if (filtroOrigine === 'tutti') return items
    return items.filter((i) => i.origine === filtroOrigine)
  }, [items, filtroOrigine])

  const conteggi = useMemo(() => ({
    tutti: items.length,
    documenti_da_processare: items.filter((i) => i.origine === 'documento_da_processare').length,
    fattura: items.filter((i) => i.origine === 'fattura').length,
    errore_sincronizzazione: items.filter((i) => i.origine === 'errore_sincronizzazione').length,
    bolla_aperta: items.filter((i) => i.origine === 'bolla_aperta').length,
  }), [items])

  const eseguiComando = async (item: CodaItem, commandId: CommandId) => {
    const dialogCommands: Record<string, DialogType> = {
      'documento.associa': 'associa',
      'documento.aggiorna_categoria': 'categoria',
      'fattura.rifiuta': 'rifiuta_fattura',
      'statement.assegna_fattura': 'assegna_fattura',
      'statement.associa_fornitore': 'associa',
    }
    const dialogTipo = dialogCommands[commandId]
    if (dialogTipo) {
      setDialogAperto({ tipo: dialogTipo, item })
      return
    }

    setEseguendoId(`${item.id}_${commandId}`)
    try {
      const cmd = getComando(commandId)
      if (!cmd) {
        showToast('Comando non trovato: ' + commandId, 'error')
        return
      }
      const result = await cmd.esegui({ item, sedeId })
      if (result.success) {
        await registraEsecuzioneDiretta(item, commandId)
        showToast(result.message || 'Operazione completata', 'success')
        caricaCoda()
      } else {
        showToast(result.error || 'Errore sconosciuto', 'error')
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Errore sconosciuto', 'error')
    } finally {
      setEseguendoId(null)
    }
  }

  const confermaSuggerimento = async (item: CodaItem, commandId: CommandId) => {
    const ok = await registraConfermaApprendimento(item, commandId, true)
    if (ok) {
      await eseguiComando(item, commandId)
    }
  }

  const rifiutaSuggerimento = async (item: CodaItem, commandId: CommandId) => {
    await registraConfermaApprendimento(item, commandId, false)
    setSuggerimenti((prev) => {
      const next = new Map(prev)
      next.delete(item.id)
      return next
    })
  }

  const handleDialogSuccess = (message: string, itemId?: string) => {
    showToast(message, 'success')
    if (itemId) {
      setItems(prev => prev.filter(i => i.id !== itemId))
    }
  }

  const handleAutoResolve = async () => {
    setAutoResolving(true)
    try {
      const res = await fetch('/api/documenti-associati/auto-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (data.success) {
        showToast(data.message, 'success')
      } else {
        showToast(data.error || 'Errore auto-resolve', 'error')
      }
      await caricaCoda()
    } catch (e) {
      showToast(`Errore: ${e instanceof Error ? e.message : 'Richiesta fallita'}`, 'error')
    } finally {
      setAutoResolving(false)
    }
  }

  return (
    <div className="space-y-4 pb-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="Totale"
          valore={conteggi.tutti}
          icona={<AlertCircle className="w-5 h-5" />}
          colore="text-app-fg-muted"
          attivo={filtroOrigine === 'tutti'}
          onClick={() => setFiltroOrigine('tutti')}
        />
        <StatCard
          label="Documenti"
          valore={conteggi.documenti_da_processare}
          icona={<FileText className="w-5 h-5" />}
          colore="text-sky-400"
          attivo={filtroOrigine === 'documento_da_processare'}
          onClick={() => setFiltroOrigine('documento_da_processare')}
        />
        <StatCard
          label="Fatture"
          valore={conteggi.fattura}
          icona={<CheckCircle className="w-5 h-5" />}
          colore="text-emerald-400"
          attivo={filtroOrigine === 'fattura'}
          onClick={() => setFiltroOrigine('fattura')}
        />
        <StatCard
          label="Errori sincro"
          valore={conteggi.errore_sincronizzazione}
          icona={<X className="w-5 h-5" />}
          colore="text-rose-400"
          attivo={filtroOrigine === 'errore_sincronizzazione'}
          onClick={() => setFiltroOrigine('errore_sincronizzazione')}
        />
        <StatCard
          label="Bolle aperte"
          valore={conteggi.bolla_aperta}
          icona={<ExternalLink className="w-5 h-5" />}
          colore="text-amber-400"
          attivo={filtroOrigine === 'bolla_aperta'}
          onClick={() => setFiltroOrigine('bolla_aperta')}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={handleAutoResolve}
          disabled={autoResolving}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
        >
          <Zap className="w-3.5 h-3.5" />
          {autoResolving ? 'Auto-risolvo...' : 'Auto-risolvi anomalie'}
        </button>
        <a
          href="/centro-controllo/apprendimento"
          className="inline-flex items-center gap-1.5 rounded-lg bg-app-line-15 px-3 py-1.5 text-xs font-medium text-app-fg-muted transition-colors hover:bg-app-line-25"
        >
          <Brain className="w-3.5 h-3.5" />
          Apprendimento AI
        </a>
      </div>

      {associatiStats && associatiStats.con_anomalie > 0 && (
        <div className="app-card overflow-hidden">
          <button
            type="button"
            onClick={() => setAssociatiOpen(!associatiOpen)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-app-line-5"
          >
            <div className="flex items-center gap-3">
              <span className={`text-sm font-semibold ${associatiOpen ? 'text-amber-300' : 'text-app-fg-muted'}`}>
                Documenti associati con anomalie
              </span>
              <span className="inline-flex items-center justify-center rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                {associatiStats.con_anomalie}
              </span>
              <span className="text-xs text-app-fg-muted">
                ({associatiStats.anomalie_totali} anomalie)
              </span>
            </div>
            <span className={`text-app-fg-muted transition-transform ${associatiOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>
          {associatiOpen && associatiDocs.length > 0 && (
             <div className="border-t border-app-line-15">
               {associatiDocs.slice(0, 20).map((doc: unknown) => {
                 const d = doc as Record<string, unknown>
                 return (
                 <div key={d.id as string} className="flex items-center gap-3 border-b border-app-line-10 px-4 py-2.5 text-xs last:border-0">
                   <div className="min-w-0 flex-1">
                     <p className="truncate font-medium text-app-fg">{d.fornitore ? (d.fornitore as Record<string, unknown>).nome as string : '—'}</p>
                     <p className="truncate text-app-fg-muted">{d.file_name as string ?? ''}</p>
                   </div>
                   <span className="inline-flex items-center rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                     {(d.anomalie as unknown[]).length} anomalie
                   </span>
                 </div>
                 )
               })}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-app-fg-muted" />
          <span className="ml-2 text-app-fg-muted">Caricamento coda...</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-950/30 border border-rose-800/40 rounded-lg text-rose-300 text-sm">
          {error}
          <button onClick={caricaCoda} className="ml-2 underline hover:no-underline">Riprova</button>
        </div>
      )}

      {!loading && !error && itemsFiltrati.length === 0 && (
        <div className="text-center py-12 text-app-fg-muted">
          <CheckCircle className="w-12 h-12 mx-auto mb-3 text-white/[0.12]" />
          <p className="text-lg font-medium">Nessun documento in coda</p>
          <p className="text-sm">Tutti i documenti sono stati processati</p>
        </div>
      )}

      {!loading && !error && itemsFiltrati.length > 0 && (
        <div className="space-y-2">
          {itemsFiltrati.map((item) => (
            <RigaDocumento
              key={item.id}
              item={item}
              sedeId={sedeId}
              suggerimento={suggerimenti.get(item.id) ?? null}
              eseguendoId={eseguendoId}
              onEsegui={eseguiComando}
              onConfermaSuggerimento={confermaSuggerimento}
              onRifiutaSuggerimento={rifiutaSuggerimento}
            />
          ))}
        </div>
      )}

      {cmdPaletteAperta && (
        <CommandPalette
          items={itemsFiltrati}
          ricerca={ricercaCmd}
          onRicercaChange={setRicercaCmd}
          onEsegui={(itemId, commandId) => {
            const item = items.find((i) => i.id === itemId)
            if (item) eseguiComando(item, commandId)
          }}
          onChiudi={() => {
            setCmdPaletteAperta(false)
            setRicercaCmd('')
          }}
        />
      )}

      <AssociaFornitoreDialog
        open={dialogAperto?.tipo === 'associa'}
        item={dialogAperto?.item ?? null}
        sedeId={sedeId}
        onClose={() => setDialogAperto(null)}
        onSuccess={handleDialogSuccess}
      />
      <AggiornaCategoriaDialog
        open={dialogAperto?.tipo === 'categoria'}
        item={dialogAperto?.item ?? null}
        onClose={() => setDialogAperto(null)}
        onSuccess={handleDialogSuccess}
      />
      <RifiutaFatturaDialog
        open={dialogAperto?.tipo === 'rifiuta_fattura'}
        item={dialogAperto?.item ?? null}
        onClose={() => setDialogAperto(null)}
        onSuccess={handleDialogSuccess}
      />
      <AssegnaFatturaDialog
        open={dialogAperto?.tipo === 'assegna_fattura'}
        item={dialogAperto?.item ?? null}
        sedeId={sedeId}
        onClose={() => setDialogAperto(null)}
        onSuccess={handleDialogSuccess}
      />
    </div>
  )
}

function StatCard({
  label,
  valore,
  icona,
  colore,
  attivo,
  onClick,
}: {
  label: string
  valore: number
  icona: React.ReactNode
  colore: string
  attivo: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`app-card overflow-hidden p-4 text-left transition-colors ${
        attivo
          ? 'ring-1 ring-sky-500/30 border-sky-600/40'
          : 'border-app-line-22 hover:border-app-line-28'
      }`}
    >
      <div className={`mb-2 flex items-center gap-2`}>
        <span className={colore}>{icona}</span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{label}</p>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${colore}`}>{valore}</p>
    </button>
  )
}

function RigaDocumento({
  item,
  sedeId,
  suggerimento,
  eseguendoId,
  onEsegui,
  onConfermaSuggerimento,
  onRifiutaSuggerimento,
}: {
  item: CodaItem
  sedeId: string | null
  suggerimento: AiSuggestion | null
  eseguendoId: string | null
  onEsegui: (item: CodaItem, commandId: CommandId) => void
  onConfermaSuggerimento: (item: CodaItem, commandId: CommandId) => void
  onRifiutaSuggerimento: (item: CodaItem, commandId: CommandId) => void
}) {
  const priorita = formattaPriorita(item.priorita)
  const isRunning = eseguendoId?.startsWith(item.id)
  const [azioniDisponibili, setAzioniDisponibili] = useState<Command[]>([])

  const statementId = item.origine === 'riga_statement'
    ? (item.contesto_originale as Record<string, unknown> | null)?.statement_id as string | undefined
    : undefined

  const hasDoc = !!(
    (item.origine === 'documento_da_processare' && item.file_url) ||
    (item.origine === 'fattura' && item.file_url) ||
    (item.origine === 'bolla_aperta' && item.file_url) ||
    (item.origine === 'riga_statement' && statementId)
  )

  const erroreDettaglio = item.origine === 'errore_sincronizzazione'
    ? (item.contesto_originale as Record<string, unknown> | null)?.errore_dettaglio as string | undefined
    : undefined

  const ctx = item.contesto_originale as Record<string, unknown> | null

  const deltaImporto = item.origine === 'riga_statement'
    ? ctx?.delta_importo as number | undefined
    : undefined

  const fatturaCollegata = item.origine === 'riga_statement'
    ? ctx?.fattura_numero as string | undefined
    : undefined

  const bolleCollegate = item.origine === 'riga_statement'
    ? ctx?.bolle_json as Array<{numero_bolla?: string; importo?: number}> | undefined
    : undefined

  const importoFormattato = item.importo != null
    ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(item.importo)
    : null

  const ocrInfo: string[] = []
  if (item.ocr_tipo) ocrInfo.push(`OCR: ${item.ocr_tipo}`)
  if (item.ocr_ragione_sociale) ocrInfo.push(item.ocr_ragione_sociale)
  if (item.ocr_p_iva) ocrInfo.push(`P.IVA: ${item.ocr_p_iva}`)
  if (item.matched_by) ocrInfo.push(`Match: ${item.matched_by}`)

  useEffect(() => {
    comandiApplicabili({ item, sedeId }).then((cmds) => {
      setAzioniDisponibili(cmds.filter((c) => c.id !== 'documento.apri'))
    })
  }, [item, sedeId])

  return (
    <div className="app-card overflow-hidden">
      <div className={`app-card-bar-accent ${priorita.colore.split(' ')[0].replace('text-', 'bg-')}`} aria-hidden />
      <div className="flex items-start gap-3 p-3 md:gap-4 md:p-4">
        <div className="flex-1 min-w-0">
          {/* ── Riga 1: priorità · tipo · fornitore · importo ── */}
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${priorita.colore}`}>
              {priorita.label}
            </span>
            <TipoBadge origine={item.origine} pendingKind={item.pending_kind} />
            {item.fornitore_nome && (
              <span className="text-xs font-medium text-app-fg truncate max-w-[140px] md:max-w-[200px]" title={item.fornitore_nome}>
                {item.fornitore_nome}
              </span>
            )}
            {importoFormattato && (
              <span className="text-xs font-mono tabular-nums text-app-fg-muted ml-auto">{importoFormattato}</span>
            )}
          </div>

          {/* ── Riga 2: riferimento / numero documento ── */}
          {hasDoc ? (
            <div className="mb-0.5">
              <OpenDocumentInAppButton
                documentoId={item.origine === 'documento_da_processare' ? item.id : undefined}
                fatturaId={item.origine === 'fattura' ? item.id : undefined}
                bollaId={item.origine === 'bolla_aperta' ? item.id : undefined}
                statementId={item.origine === 'riga_statement' ? statementId : undefined}
                fileUrl={item.file_url}
                className="group inline-flex items-center gap-1 text-xs font-medium text-sky-300 transition-colors hover:text-sky-200 truncate max-w-full"
              >
                <ExternalLink className="w-3 h-3 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                <span className="truncate">{item.numero_documento || item.riferimenti || item.nome_file || 'Apri documento'}</span>
              </OpenDocumentInAppButton>
            </div>
          ) : (
            <p className="text-xs text-app-fg-muted/60 truncate mb-0.5">
              {item.numero_documento || item.riferimenti || item.nome_file || 'Senza riferimento'}
            </p>
          )}

          {/* ── Riga 3: nome file (se diverso dal riferimento) ── */}
          {item.nome_file && item.nome_file !== item.riferimenti && item.nome_file !== item.numero_documento && (
            <p className="text-[11px] text-app-fg-muted/50 truncate mb-0.5">{item.nome_file}</p>
          )}

          {/* ── Riga 4: mittente · oggetto mail ── */}
          {(item.mittente || item.oggetto_mail) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-0.5 text-[11px] text-app-fg-muted/60">
              {item.mittente && <span>{item.mittente}</span>}
              {item.oggetto_mail && (
                <span className="truncate max-w-[300px]" title={item.oggetto_mail}>
                  «{item.oggetto_mail}»
                </span>
              )}
            </div>
          )}

          {/* ── Riga 5: info OCR ── */}
          {ocrInfo.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 mb-0.5">
              {ocrInfo.map((info, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-app-line-15 text-app-fg-muted/70">
                  {info}
                </span>
              ))}
            </div>
          )}

          {/* ── Riga 6: date ── */}
          <div className="flex items-center gap-3 text-[11px] text-app-fg-muted/50">
            {item.data_doc && <span>Data doc: {item.data_doc}</span>}
            {item.data_inserimento && <span>Inserito: {item.data_inserimento}</span>}
            {item.giorni_in_stato != null && (
              <span className={item.giorni_in_stato > 7 ? 'text-rose-300/70' : ''}>
                {item.giorni_in_stato}g in stato
              </span>
            )}
          </div>

          {/* ── Riga 7: dettaglio errore sincro ── */}
          {erroreDettaglio && (
            <div className="mt-1 text-[11px] text-rose-300/70 truncate max-w-full" title={erroreDettaglio}>
              {erroreDettaglio}
            </div>
          )}

          {/* ── Riga 8: contesto estratto conto (delta, fattura, bolle) ── */}
          {item.origine === 'riga_statement' && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              {deltaImporto != null && (
                <span className={deltaImporto === 0 ? 'text-emerald-300/70' : 'text-rose-300/70'}>
                  Delta: {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(deltaImporto)}
                </span>
              )}
              {fatturaCollegata && (
                <span className="text-app-fg-muted/60">Fattura: {fatturaCollegata}</span>
              )}
              {bolleCollegate && bolleCollegate.length > 0 && (
                <span className="text-app-fg-muted/60">
                  Bolle: {bolleCollegate.map(b => b.numero_bolla).filter(Boolean).join(', ') || `${bolleCollegate.length} bolla(e)`}
                </span>
              )}
              {!deltaImporto && !fatturaCollegata && (!bolleCollegate || bolleCollegate.length === 0) && (
                <span className="text-app-fg-muted/40">Nessun riferimento collegato</span>
              )}
            </div>
          )}

          {/* ── Suggerimento AI ── */}
          {suggerimento && (
            <div className="mt-2 flex flex-wrap items-center gap-2 p-2 bg-teal-950/30 border border-teal-800/40 rounded text-sm">
              <span className="text-teal-300 font-medium">Suggerimento:</span>
              <span className="text-teal-200">{suggerimento.label}</span>
              <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                suggerimento.confidenza >= 0.9 ? 'bg-teal-800/60 text-teal-200' : 'bg-amber-900/50 text-amber-200'
              }`}>
                {Math.round(suggerimento.confidenza * 100)}%
              </span>
              <span className="text-xs text-app-fg-muted">({suggerimento.totali_conferme} conferme)</span>
              <div className="ml-auto flex gap-1">
                <button
                  onClick={() => onConfermaSuggerimento(item, suggerimento.azione_id)}
                  disabled={!!isRunning}
                  className="p-1 rounded hover:bg-teal-800/60 text-teal-300 disabled:opacity-50"
                  title="Conferma suggerimento"
                >
                  <GlyphCheck className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onRifiutaSuggerimento(item, suggerimento.azione_id)}
                  className="p-1 rounded hover:bg-rose-950/60 text-rose-400"
                  title="Rifiuta suggerimento"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Pulsanti azione ── */}
          {azioniDisponibili.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-app-line-15 pt-3">
              {azioniDisponibili.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => onEsegui(item, cmd.id)}
                  disabled={!!isRunning}
                  className="inline-flex items-center gap-1 rounded-lg bg-app-line-15 px-3 py-1.5 text-xs font-medium text-app-fg-muted transition-colors hover:bg-app-line-25 disabled:opacity-40"
                >
                  {cmd.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TipoBadge({ origine, pendingKind }: { origine: string; pendingKind: string }) {
  const baseClass = 'text-xs font-medium px-1.5 py-0.5 rounded'

  if (origine === 'documento_da_processare') {
    if (pendingKind === 'da_determinare') {
      return <span className={`${baseClass} bg-fuchsia-950/60 text-fuchsia-300`}>Da classificare</span>
    }
    return <span className={`${baseClass} bg-sky-950/60 text-sky-300`}>{labelPendingKind(pendingKind)}</span>
  }

  if (origine === 'riga_statement') {
    return <span className={`${baseClass} bg-orange-950/60 text-orange-300`}>Estratto conto</span>
  }

  if (origine === 'fattura') {
    return <span className={`${baseClass} bg-emerald-950/60 text-emerald-300`}>Fattura</span>
  }

  if (origine === 'errore_sincronizzazione') {
    return <span className={`${baseClass} bg-rose-950/60 text-rose-300`}>Errore sincro</span>
  }

  if (origine === 'bolla_aperta') {
    return <span className={`${baseClass} bg-amber-950/60 text-amber-300`}>Bolla aperta</span>
  }

  return <span className={`${baseClass} bg-app-line-15 text-app-fg-muted`}>{origine}</span>
}

function CommandPalette({
  items,
  ricerca,
  onRicercaChange,
  onEsegui,
  onChiudi,
}: {
  items: CodaItem[]
  ricerca: string
  onRicercaChange: (v: string) => void
  onEsegui: (itemId: string, commandId: CommandId) => void
  onChiudi: () => void
}) {
  const comandi = tuttiComandi()
  const [selectedIndex, setSelectedIndex] = useState(0)

  const risultati = useMemo(() => {
    if (!ricerca.trim()) return comandi
    const q = ricerca.toLowerCase()
    return comandi.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.descrizione.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q),
    )
  }, [comandi, ricerca])

  useEffect(() => {
    setSelectedIndex(0)
  }, [ricerca])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, risultati.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && risultati[selectedIndex] && items.length > 0) {
        const item = items[0]
        onEsegui(item.id, risultati[selectedIndex].id)
        onChiudi()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [risultati, selectedIndex, items, onEsegui, onChiudi])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onChiudi}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative app-card overflow-hidden w-full max-w-lg border-app-line-22 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-app-line-22">
          <Search className="w-4 h-4 text-app-fg-muted" />
          <input
            autoFocus
            type="text"
            value={ricerca}
            onChange={(e) => onRicercaChange(e.target.value)}
            placeholder="Cerca un comando..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-app-fg-muted text-app-fg"
          />
          <kbd className="text-[10px] text-app-fg-muted bg-app-line-15 px-1.5 py-0.5 rounded font-mono">ESC</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {risultati.length === 0 && (
            <p className="text-sm text-app-fg-muted text-center py-4">Nessun comando trovato</p>
          )}
          {risultati.map((cmd, i) => (
            <button
              key={cmd.id}
              className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                i === selectedIndex ? 'bg-sky-950/50 text-sky-200' : 'text-app-fg hover:bg-white/[0.04]'
              }`}
              onClick={() => {
                if (items.length > 0) {
                  onEsegui(items[0].id, cmd.id)
                  onChiudi()
                }
              }}
            >
              <span className="text-app-fg-muted text-xs font-mono w-6 text-right">
                {i + 1}
              </span>
              <div className="flex-1">
                <p className="font-medium text-inherit">{cmd.label}</p>
                <p className="text-xs text-app-fg-muted">{cmd.descrizione}</p>
              </div>
              {cmd.shortcut && (
                <kbd className="text-[10px] text-app-fg-muted bg-app-line-15 px-1.5 py-0.5 rounded font-mono">
                  {cmd.shortcut}
                </kbd>
              )}
            </button>
          ))}
        </div>

        <div className="px-4 py-2.5 border-t border-app-line-15 text-[10px] text-app-fg-muted flex items-center gap-4">
          <span>↑↓ Naviga</span>
          <span>↵ Esegui</span>
          <span>⌘K / ESC Chiudi</span>
        </div>
      </div>
    </div>
  )
}
