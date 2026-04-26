'use client'

import { useMe } from '@/lib/me-context'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/use-t'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import GeminiUsageDashboard, { type GeminiUsageDashboardHandle } from '@/components/GeminiUsageDashboard'

export default function ConsumiAiPage() {
  const { me, loading } = useMe()
  const router = useRouter()
  const t = useT()
  const dashRef = useRef<GeminiUsageDashboardHandle>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [fixOcrLoading, setFixOcrLoading] = useState(false)
  const [fixOcrResult, setFixOcrResult] = useState<string | null>(null)
  const [fixOcrError, setFixOcrError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && me?.role !== 'admin') {
      router.replace('/')
    }
  }, [me, loading, router])

  const handleRefresh = () => {
    setRefreshing(true)
    dashRef.current?.refresh()
    setTimeout(() => setRefreshing(false), 1200)
  }

  const handleFixOcrDates = async () => {
    setFixOcrError(null)
    setFixOcrResult(null)
    setFixOcrLoading(true)
    try {
      const res = await fetch('/api/admin/fix-ocr-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: 40 }),
      })
      const data = (await res.json()) as {
        error?: string
        corrected?: number
        totalSuspicious?: number
        scanned?: number
        remaining?: number
        dateOnlyFixes?: number
        tipoMigratedToFattura?: number
        tipoMigratedToBolla?: number
        errors?: { message: string }[]
      }
      if (!res.ok) {
        setFixOcrError(data.error ?? `HTTP ${res.status}`)
        return
      }
      setFixOcrResult(
        `Corretti: ${data.corrected ?? 0} (su ${data.scanned ?? 0} scansioni; sospetti totali: ${
          data.totalSuspicious ?? 0
        }${data.remaining ? `; ancora in coda: ${data.remaining}` : ''}) — ` +
          `date in-place: ${data.dateOnlyFixes ?? 0}, → fattura: ${
            data.tipoMigratedToFattura ?? 0
          }, → bolla: ${data.tipoMigratedToBolla ?? 0}.` +
          (data.errors?.length ? ` Errori: ${data.errors.length}.` : ''),
      )
    } catch (e) {
      setFixOcrError(e instanceof Error ? e.message : 'Errore di rete')
    } finally {
      setFixOcrLoading(false)
    }
  }

  if (loading || me?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-app-cyan-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="app-shell-page-padding">
      <AppPageHeaderStrip
        icon={
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
            />
          </svg>
        }
      >
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-app-fg sm:text-lg">
            {t.nav.consumiAi}
          </h1>
          <p className="text-xs text-app-fg-muted">
            Gemini 2.5 Flash-Lite — token usati, costo per scan, totale stimato
          </p>
        </div>

        <button
          type="button"
          onClick={handleFixOcrDates}
          disabled={fixOcrLoading}
          className="hidden shrink-0 items-center justify-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-200 transition-colors hover:bg-amber-500/20 disabled:opacity-50 sm:inline-flex"
        >
          {fixOcrLoading ? 'Migrazione…' : 'Fix date OCR'}
        </button>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-white/10 disabled:opacity-40"
          aria-label="Aggiorna dati"
        >
          <svg
            className={`h-4 w-4 text-app-fg-muted ${refreshing ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </AppPageHeaderStrip>

      <div className="mb-4 sm:hidden">
        <button
          type="button"
          onClick={handleFixOcrDates}
          disabled={fixOcrLoading}
          className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-200 disabled:opacity-50"
        >
          {fixOcrLoading ? 'Migrazione date OCR in corso…' : 'Fix date OCR'}
        </button>
      </div>

      {fixOcrError ? (
        <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {fixOcrError}
        </p>
      ) : null}
      {fixOcrResult ? (
        <p className="mb-4 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {fixOcrResult}
        </p>
      ) : null}

      <GeminiUsageDashboard ref={dashRef} />
    </div>
  )
}
