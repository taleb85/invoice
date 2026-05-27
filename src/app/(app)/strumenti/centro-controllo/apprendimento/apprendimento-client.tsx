'use client'

import { useCallback, useEffect, useState } from 'react'
import { useT } from '@/lib/use-t'
import type { Translations } from '@/lib/translations'
import { Loader2, AlertCircle, CheckCircle, XCircle, Brain, TrendingUp, Zap } from 'lucide-react'
import type { ApprendimentoStats } from '@/app/api/centro-controllo/apprendimento/route'

interface Props {
  sedeId: string | null
}

function translateActionLabel(azioneId: string, fallback: string, t: Translations): string {
  const m = t.apprendimento
  const map: Record<string, string> = {
    'documento.scarta': m.actionDocumentoScarta,
    'documento.associa': m.actionDocumentoAssocia,
    'documento.finalizza_come_fattura': m.actionDocumentoFattura,
    'documento.finalizza_come_bolla': m.actionDocumentoBolla,
    'documento.finalizza_come_nota_credito': m.actionDocumentoNotaCredito,
    'documento.finalizza_come_statement': m.actionDocumentoStatement,
    'documento.finalizza_come_ordine': m.actionDocumentoOrdine,
    'documento.finalizza_come_comunicazione': m.actionDocumentoComunicazione,
    'documento.rianalizza_ocr': m.actionDocumentoRianalizzaOcr,
    'documento.ignora_mittente': m.actionDocumentoIgnoraMittente,
    'documento.apri': m.actionDocumentoApri,
    'documento.aggiorna_categoria': m.actionDocumentoAggiornaCategoria,
    'fattura.approva': m.actionFatturaApprova,
    'fattura.rifiuta': m.actionFatturaRifiuta,
    'fattura.resetta_approvazione': m.actionFatturaResetta,
    'statement.segna_come_ok': m.actionStatementOk,
    'statement.assegna_fattura': m.actionStatementAssegna,
    'statement.ricalcola': m.actionStatementRicalcola,
  }
  return map[azioneId] || fallback
}

export default function ApprendimentoClient({ sedeId }: Props) {
  const t = useT()
  const [stats, setStats] = useState<ApprendimentoStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (sedeId) params.set('sede_id', sedeId)
      const res = await fetch(`/api/centro-controllo/apprendimento?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      setStats(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : t.apprendimento.errorLoadStats)
    } finally {
      setLoading(false)
    }
  }, [sedeId, t])

  useEffect(() => { loadStats() }, [loadStats])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-app-fg-muted" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <AlertCircle className="h-10 w-10 text-rose-400" />
        <p className="text-sm text-rose-300">{error}</p>
        <button onClick={loadStats} className="rounded-lg border border-app-line-28 px-4 py-2 text-xs font-semibold text-app-fg-muted hover:text-app-fg">
          {t.apprendimento.retry}
        </button>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="space-y-6 pb-10">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard
            icon={<Brain className="h-5 w-5" />}
            label={t.apprendimento.statPatterns}
            value={stats.pattern_totali}
            color="text-teal-400"
          />
          <StatCard
            icon={<CheckCircle className="h-5 w-5" />}
            label={t.apprendimento.statConfirmations}
            value={stats.conferme_totali}
            color="text-emerald-400"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label={t.apprendimento.statAvgConfidence}
            value={`${stats.confidenza_media}%`}
            color="text-cyan-400"
          />
          <StatCard
            icon={<Zap className="h-5 w-5" />}
            label={t.apprendimento.statAutoExecutable}
            value={stats.pattern_auto_eseguibili}
            color={stats.pattern_auto_eseguibili > 0 ? 'text-amber-400' : 'text-app-fg-muted'}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="app-card overflow-hidden">
            <div className="border-b border-app-line-28 px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-app-fg">{t.apprendimento.sectionTopActions}</h2>
            </div>
            <div className="divide-y divide-app-line-28">
              {stats.azioni_piu_comuni.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-app-fg-muted">{t.apprendimento.emptyTopActions}</p>
              )}
              {stats.azioni_piu_comuni.map((a) => (
                <div key={a.azione_id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-app-fg">{translateActionLabel(a.azione_id, a.label, t)}</span>
                  <span className="rounded-full bg-app-line-28 px-2.5 py-0.5 text-[10px] font-bold tabular-nums text-app-fg-muted">
                    {a.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="app-card overflow-hidden">
            <div className="border-b border-app-line-28 px-4 py-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-app-fg">{t.apprendimento.sectionRecentActivity}</h2>
            </div>
            <div className="max-h-[320px] divide-y divide-app-line-28 overflow-y-auto">
              {stats.log_recenti.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-app-fg-muted">{t.apprendimento.emptyRecentActivity}</p>
              )}
              {stats.log_recenti.map((log) => (
                <div key={log.id} className="flex items-center gap-3 px-4 py-2.5">
                  {log.confermata && log.eseguita ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : log.confermata ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-cyan-400" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-app-fg">{translateActionLabel(log.azione_id, log.label || log.azione_id, t)}</p>
                    <p className="text-[10px] text-app-fg-muted">
                      {new Date(log.created_at).toLocaleString('it-IT', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    log.confermata && log.eseguita
                      ? 'bg-emerald-950/60 text-emerald-300'
                      : log.confermata
                        ? 'bg-cyan-950/60 text-cyan-300'
                        : 'bg-red-950/60 text-rose-300'
                  }`}>
                    {log.confermata && log.eseguita ? t.apprendimento.activityExecuted : log.confermata ? t.apprendimento.activityConfirmed : t.apprendimento.activityRejected}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="app-card overflow-hidden">
          <div className="border-b border-app-line-28 px-4 py-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-app-fg">{t.apprendimento.sectionLearningStatus}</h2>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              <ProgressRow
                label={t.apprendimento.progressConfirmsOverSuggestions}
                value={stats.conferme_totali}
                max={stats.conferme_totali + stats.suggerimenti_totali || 1}
                color="bg-emerald-500"
              />
              <ProgressRow
                label={t.apprendimento.progressPatternsAutoExec}
                value={stats.pattern_auto_eseguibili}
                max={stats.pattern_totali || 1}
                color="bg-amber-500"
              />
              <ProgressRow
                label={t.apprendimento.progressPatternsConfirmed3}
                value={stats.azioni_piu_comuni.reduce((acc, a) => acc + a.count, 0)}
                max={stats.pattern_totali || 1}
                color="bg-teal-500"
              />
            </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="app-card overflow-hidden p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className={color}>{icon}</span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{label}</p>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  )
}

function ProgressRow({ label, value, max, color }: {
  label: string
  value: number
  max: number
  color: string
}) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-app-fg-muted">{label}</span>
        <span className="font-semibold text-app-fg">{value}/{max}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-app-line-28">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
