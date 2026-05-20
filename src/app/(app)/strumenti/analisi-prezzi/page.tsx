'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/lib/toast-context'
import { useT } from '@/lib/use-t'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { BackButton } from '@/components/BackButton'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import type { SupplierPriceHealth } from '@/lib/price-intelligence'

type DashboardData = {
  suppliers: SupplierPriceHealth[]
  totali: number
  critici: number
  attenzione: number
  ok: number
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
  const router = useRouter()
  const { showToast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState<{
    fornitore_nome: string
    trends: number
    anomalie: number
    raccomandazioni: number
    punteggio_salute: number
  } | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/listino/price-intelligence')
      if (!res.ok) throw new Error(`Errore ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Errore caricamento', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="cyan"
        leadingAccessory={<BackButton href="/strumenti" label="Strumenti" iconOnly className="mb-0 shrink-0" />}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 3v18h18M7 16l4-8 4 4 4-6" />
          </svg>
        }
      >
        <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{t.strumentiAnalisiPrezzi.pageTitle}</h1>
      </AppPageHeaderStrip>

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
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-2xl font-bold text-white">{data.totali}</div>
              <div className="text-[11px] text-white/40">Fornitori analizzati</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-2xl font-bold text-emerald-400">{data.ok}</div>
              <div className="text-[11px] text-white/40">Salute OK (≥70%)</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-2xl font-bold text-amber-400">{data.attenzione}</div>
              <div className="text-[11px] text-white/40">Attenzione (50-69%)</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-2xl font-bold text-red-400">{data.critici}</div>
              <div className="text-[11px] text-white/40">Critici (&lt;50%)</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">Stato</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">Fornitore</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">Prodotti</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">Trend</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">Volatilità</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">Anomalie</th>
                  <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-[1.5px] text-white/40">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.suppliers.map((s) => (
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
              <p className="text-sm text-white/40">Nessun fornitore con dati prezzi sufficienti per l&apos;analisi.</p>
              <p className="mt-1 text-xs text-white/30">
                Sono necessari almeno 2 rilevazioni prezzo per prodotto per generare trend e raccomandazioni.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-sm text-white/40">Nessun dato disponibile.</p>
          <p className="mt-1 text-xs text-white/30">
            Importa listini o sincronizza prezzi dalle fatture per attivare l&apos;analisi intelligente.
          </p>
        </div>
      )}
    </div>
  )
}
