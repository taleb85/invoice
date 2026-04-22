'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useMe } from '@/lib/me-context'
import { useT } from '@/lib/use-t'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'
import AppSummaryHighlightMetrics from '@/components/AppSummaryHighlightMetrics'
import { STATEMENTS_LAYOUT_REFRESH_EVENT } from '@/lib/statements-layout-refresh'

const tabBtnBase =
  'transition-colors disabled:cursor-default disabled:opacity-100 hover:opacity-90'

export type StatementsSummaryHighlightProps = {
  /** Ambito conteggi (es. pagina `/sedi/[id]/statements`); altrimenti si usa `me.sede_id`. */
  sedeId?: string | null
  /** `routes`: link a `/statements/...` e tab attivo da URL. `tabs`: tab locali + `onTabChange`. */
  tabMode?: 'routes' | 'tabs'
  activeTab?: 'pending' | 'status'
  onTabChange?: (tab: 'pending' | 'status') => void
  /** Quando true renderizza solo le metriche senza card wrapper (per uso in `mergedSlot`). */
  embedded?: boolean
}

/**
 * Card riepilogo come sulle altre liste: conteggio contestuale + link al tab gemello.
 */
export default function StatementsSummaryHighlight({
  sedeId: sedeIdProp,
  tabMode = 'routes',
  activeTab: activeTabProp,
  onTabChange,
  embedded = false,
}: StatementsSummaryHighlightProps = {}) {
  const pathname = usePathname() ?? ''
  const t = useT()
  const { me } = useMe()
  const sedeId = (sedeIdProp ?? me?.sede_id) || undefined

  const isVerifica =
    tabMode === 'tabs'
      ? (activeTabProp ?? 'pending') === 'status'
      : pathname.includes('/verifica')

  const [pendingCount, setPendingCount] = useState(0)
  const [stmtCount, setStmtCount] = useState(0)

  const load = useCallback(async () => {
    const p = new URLSearchParams()
    p.set('stati', 'in_attesa,da_associare,bozza_creata')
    if (sedeId) p.set('sede_id', sedeId)
    try {
      const r1 = await fetch(`/api/documenti-da-processare?${p.toString()}`)
      const docs = r1.ok ? ((await r1.json()) as unknown[]) : []
      setPendingCount(Array.isArray(docs) ? docs.length : 0)
    } catch {
      setPendingCount(0)
    }

    try {
      const p2 = new URLSearchParams()
      if (sedeId) p2.set('sede_id', sedeId)
      const qs = p2.toString()
      const r2 = await fetch(`/api/statements${qs ? `?${qs}` : ''}`)
      if (r2.ok) {
        const j = (await r2.json()) as { statements?: unknown[] }
        setStmtCount(Array.isArray(j.statements) ? j.statements.length : 0)
      } else {
        setStmtCount(0)
      }
    } catch {
      setStmtCount(0)
    }
  }, [sedeId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onRefresh = () => {
      void load()
    }
    window.addEventListener(STATEMENTS_LAYOUT_REFRESH_EVENT, onRefresh)
    return () => window.removeEventListener(STATEMENTS_LAYOUT_REFRESH_EVENT, onRefresh)
  }, [load])

  const primary = isVerifica ? stmtCount : pendingCount
  const secondary = isVerifica ? t.statements.stmtReceived : t.dashboard.kpiDaProcessareSub

  const trailingTabs =
    tabMode === 'tabs' && onTabChange ? (
      <>
        <button
          type="button"
          onClick={() => onTabChange('pending')}
          className={`${tabBtnBase} font-semibold ${
            (activeTabProp ?? 'pending') === 'pending'
              ? 'text-amber-200'
              : 'text-app-fg-muted hover:text-amber-300/80'
          }`}
        >
          {t.statements.tabDocumenti}
        </button>
        <span className="text-app-fg-muted" aria-hidden>
          ·
        </span>
        <button
          type="button"
          onClick={() => onTabChange('status')}
          className={`${tabBtnBase} font-semibold ${
            activeTabProp === 'status'
              ? 'text-app-fg-muted'
              : 'text-app-fg-muted hover:text-app-fg-muted/80'
          }`}
        >
          {t.statements.tabVerifica}
        </button>
      </>
    ) : null

  const summaryAccent = isVerifica ? 'cyan' : 'amber'

  if (embedded) {
    return (
      <AppSummaryHighlightMetrics
        accent={summaryAccent}
        label={t.common.total}
        primary={primary}
        secondary={secondary}
        trailing={trailingTabs ?? undefined}
        trailingAlign={trailingTabs ? 'with-label' : 'with-metrics'}
      />
    )
  }

  return (
    <AppSummaryHighlightCard
      accent={summaryAccent}
      label={t.common.total}
      primary={primary}
      secondary={secondary}
      trailing={trailingTabs ?? undefined}
      trailingAlign={trailingTabs ? 'with-label' : 'with-metrics'}
    />
  )
}
