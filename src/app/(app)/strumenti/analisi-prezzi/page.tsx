'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, RefreshCw } from 'lucide-react'
import { useToast } from '@/lib/toast-context'
import { useT } from '@/lib/use-t'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { BackButton } from '@/components/BackButton'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import type { SupplierPriceHealth } from '@/lib/price-intelligence'
import { interpolateTemplate } from '@/lib/interpolate-template'

type DashboardData = {
  suppliers: SupplierPriceHealth[]
  totali: number
  critici: number
  attenzione: number
  ok: number
}

type HealthFilter = 'all' | 'ok' | 'attenzione' | 'critici'

function supplierHealthCategory(score: number): Exclude<HealthFilter, 'all'> {
  if (score >= 70) return 'ok'
  if (score >= 50) return 'attenzione'
  return 'critici'
}

function matchesHealthFilter(score: number, filter: HealthFilter): boolean {
  if (filter === 'all') return true
  return supplierHealthCategory(score) === filter
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full max-w-[80px] overflow-hidden rounded-full bg-white/10">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${
        score >= 70 ? 'text-emerald-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'
      }`}>
        {score}%
      </span>
    </div>
  )
}

function StatusIcon({ score }: { score: number }) {
  if (score >= 70) return <span className="text-emerald-400 text-lg">🟢</span>
  if (score >= 50) return <span className="text-amber-400 text-lg">🟡</span>
  return <span className="text-red-400 text-lg">🔴</span>
}

export default function AnalisiPrezziPage() {
  const t = useT()
  const { showToast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncStatusText, setSyncStatusText] = useState<string | null>(null)
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all')

  const ap = t.strumentiAnalisiPrezzi

  const toggleHealthFilter = useCallback((next: HealthFilter) => {
    setHealthFilter((prev) => (prev === next ? 'all' : next))
  }, [])

  const filteredSuppliers =
    data?.suppliers.filter((s) => matchesHealthFilter(s.punteggio_salute, healthFilter)) ?? []

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/listino/price-intelligence')
      if (!res.ok) {
        throw new Error(
          interpolateTemplate(t.common.httpError, { code: res.status }, `Error ${res.status}`),
        )
      }
      const json = await res.json()
      setData(json)
    } catch (e) {
      showToast(e instanceof Error ? e.message : ap.loadError ?? 'Errore caricamento', 'error')
    } finally {
      setLoading(false)
    }
  }, [ap.loadError, showToast, t])

  useEffect(() => { loadData() }, [loadData])

  const handleSyncListino = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    setSyncStatusText(
      ap.syncDiscovering ?? 'Ricerca fatture da importare…',
    )
    try {
      const discRes = await fetch('/api/listino/sync-from-fatture', { cache: 'no-store' })
      if (!discRes.ok) {
        throw new Error(
          interpolateTemplate(t.common.httpError, { code: discRes.status }, `Error ${discRes.status}`),
        )
      }
      const disc = (await discRes.json()) as {
        fornitori?: Array<{ id: string; nome: string; pending_fatture: number }>
        total_pending_fatture?: number
      }
      const fornitori = disc.fornitori ?? []
      if (fornitori.length === 0 || (disc.total_pending_fatture ?? 0) === 0) {
        showToast(ap.syncNothingPending ?? 'Nessuna fattura da importare.', 'info')
        await loadData()
        return
      }

      let righeInserite = 0
      let fattureScanned = 0
      for (let i = 0; i < fornitori.length; i++) {
        const f = fornitori[i]
        setSyncStatusText(
          interpolateTemplate(
            ap.syncProgress,
            { current: i + 1, total: fornitori.length, name: f.nome ?? '—' },
            `Fornitore ${i + 1}/${fornitori.length}`,
          ),
        )
        const res = await fetch('/api/listino/sync-from-fatture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fornitore_id: f.id }),
        })
        const json = (await res.json().catch(() => ({}))) as {
          error?: string
          righe_inserite?: number
          fatture_scanned?: number
        }
        if (!res.ok) {
          throw new Error(
            typeof json.error === 'string'
              ? json.error
              : (ap.syncError ?? 'Aggiornamento listino non riuscito'),
          )
        }
        righeInserite += json.righe_inserite ?? 0
        fattureScanned += json.fatture_scanned ?? 0
      }

      showToast(
        interpolateTemplate(
          ap.syncDone,
          { righe: righeInserite, fatture: fattureScanned },
          `Listino aggiornato: ${righeInserite} righe da ${fattureScanned} fatture.`,
        ),
        'success',
      )
      await loadData()
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : (ap.syncError ?? 'Aggiornamento listino non riuscito'),
        'error',
      )
    } finally {
      setSyncing(false)
      setSyncStatusText(null)
    }
  }, [ap, loadData, showToast, syncing, t.common.httpError])

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="cyan"
        leadingAccessory={<BackButton href="/strumenti" label={t.strumentiAnalisiPrezzi.backToTools} iconOnly className="mb-0 shrink-0" />}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 3v18h18M7 16l4-8 4 4 4-6" />
          </svg>
        }
      >
        <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{t.strumentiAnalisiPrezzi.pageTitle}</h1>
        <button
          type="button"
          onClick={() => void handleSyncListino()}
          disabled={syncing || loading}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/18 disabled:opacity-50"
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">{ap.syncButton ?? 'Aggiorna prodotti e prezzi'}</span>
        </button>
      </AppPageHeaderStrip>

      {syncStatusText ? (
        <p className="text-center text-xs text-white/50" role="status">
          {syncStatusText}
        </p>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 h-4 w-1/3 rounded bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-white/5" />
            </div>
          ))}
        </div>
      ) : data && data.totali > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              {
                key: 'all' as const,
                value: data.totali,
                label: ap.kpiSuppliersAnalyzed,
                valueClass: 'text-white',
                activeClass: 'border-cyan-400/50 bg-cyan-500/10 ring-1 ring-cyan-400/25',
              },
              {
                key: 'ok' as const,
                value: data.ok,
                label: ap.kpiHealthOk,
                valueClass: 'text-emerald-400',
                activeClass: 'border-emerald-400/50 bg-emerald-500/10 ring-1 ring-emerald-400/25',
              },
              {
                key: 'attenzione' as const,
                value: data.attenuzione,
                label: ap.kpiAttention,
                valueClass: 'text-amber-400',
                activeClass: 'border-amber-400/50 bg-amber-500/10 ring-1 ring-amber-400/25',
              },
              {
                key: 'critici' as const,
                value: data.critici,
                label: ap.kpiCritical,
                valueClass: 'text-red-400',
                activeClass: 'border-red-400/50 bg-red-500/10 ring-1 ring-red-400/25',
              },
            ]).map((kpi) => {
              const isActive = healthFilter === kpi.key
              return (
                <button
                  key={kpi.key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => toggleHealthFilter(kpi.key)}
                  className={`rounded-xl border p-4 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 ${
                    isActive
                      ? kpi.activeClass
                      : 'border-white/10 bg-white/[0.03]'
                  }`}
                >
                  <div className={`text-2xl font-bold tabular-nums ${kpi.valueClass}`}>{kpi.value}</div>
                  <div className="text-[11px] text-white/40">{kpi.label}</div>
                </button>
              )
            })}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">{t.strumentiAnalisiPrezzi.tableColStato}</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">{t.strumentiAnalisiPrezzi.tableColFornitore}</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">{t.strumentiAnalisiPrezzi.tableColProdotti}</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">{t.strumentiAnalisiPrezzi.tableColTrend}</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">{t.strumentiAnalisiPrezzi.tableColVolatilita}</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">{t.strumentiAnalisiPrezzi.tableColAnomalie}</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">{t.strumentiAnalisiPrezzi.tableColScore}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-2 py-8 text-center text-sm text-white/40">
                      {ap.filterEmptyCategory}
                    </td>
                  </tr>
                ) : null}
                {filteredSuppliers.map((s) => (
                  <tr key={s.fornitore_id} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                    <td className="px-2 py-2.5">
                      <StatusIcon score={s.punteggio_salute} />
                    </td>
                    <td className="px-2 py-2.5">
                      <Link
                        href={`/fornitori/${s.fornitore_id}?tab=listino`}
                        className="font-semibold text-white transition-colors hover:text-sky-400"
                      >
                        {s.fornitore_nome}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 text-white/60">{s.prodotti_analizzati}</td>
                    <td className="px-2 py-2.5">
                      <span className={`text-xs font-semibold ${
                        s.trend_complessivo > 0 ? 'text-red-400'
                        : s.trend_complessivo < 0 ? 'text-emerald-400'
                        : 'text-white/40'
                      }`}>
                        {s.trend_complessivo > 0 ? `+${s.trend_complessivo}%` : s.trend_complessivo < 0 ? `${s.trend_complessivo}%` : '—'}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-white/60">
                      {s.volatilita_media > 0 ? `${(s.volatilita_media * 100).toFixed(0)}%` : '—'}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className={`text-xs font-semibold ${
                        s.anomalie_attive > 0 ? 'text-red-400' : 'text-white/40'
                      }`}>
                        {s.anomalie_attive}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <HealthBar score={s.punteggio_salute} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.totali === 0 && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <p className="text-sm text-white/40">{t.strumentiAnalisiPrezzi.emptyInsufficientData}</p>
              <p className="mt-1 text-xs text-white/30">
                {t.strumentiAnalisiPrezzi.emptyInsufficientDataHint}
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-sm text-white/40">{t.strumentiAnalisiPrezzi.emptyNoData}</p>
          <p className="mt-1 text-xs text-white/30">
            {t.strumentiAnalisiPrezzi.emptyNoDataHint}
          </p>
        </div>
      )}
    </div>
  )
}
