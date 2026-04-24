'use client'

import { Suspense } from 'react'
import useSWR from 'swr'
import { usePathname, useSearchParams } from 'next/navigation'
import { useLocale } from '@/lib/locale-context'
import { normalizeAppPath } from '@/lib/mobile-hub-routes'
import type { OperatorWorkspaceHeaderPayload } from '@/types/operator-workspace-header'
import DashboardWorkspaceQuickNav from '@/components/DashboardWorkspaceQuickNav'
import DashboardHeaderSedeToolsMenu from '@/components/DashboardHeaderSedeToolsMenu'

const headerFetcher = (url: string): Promise<OperatorWorkspaceHeaderPayload | null> =>
  fetch(url).then((r) => (r.ok ? r.json() : null))

function OperatorDesktopWorkspaceHeaderInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useLocale()
  const normalized = normalizeAppPath(pathname ?? '')
  const hideStrip = normalized.startsWith('/fornitori')
  const fyRaw = searchParams?.get('fy')?.trim() ?? ''
  const fyQuery = fyRaw ? `fy=${encodeURIComponent(fyRaw)}` : ''

  // Passing null as key disables the fetch when hideStrip is true
  const swrKey = hideStrip
    ? null
    : fyQuery
      ? `/api/operator-workspace-header?${fyQuery}`
      : '/api/operator-workspace-header'

  const { data } = useSWR<OperatorWorkspaceHeaderPayload | null>(swrKey, headerFetcher, {
    revalidateOnFocus: false,
    dedupingInterval:  20_000,
    refreshInterval:   60_000,
  })

  // Gestionale senza sede selezionata (operatorScoped=false): nessun menu da mostrare.
  if (hideStrip || !data || !data.operatorScoped) return null

  return (
    <div
      className={`flex min-w-0 w-full max-w-full shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2 md:overflow-x-auto ${
        data.operatorScoped ? 'justify-between' : 'justify-end'
      }`}
    >
      {data.operatorScoped && data.counts ? (
        <DashboardWorkspaceQuickNav
          t={t}
          fiscalYear={data.fiscalYear}
          counts={{
            ordini:     data.counts.ordini,
            bolle:      data.counts.bolle,
            fatture:    data.counts.fatture,
            statements: data.counts.statements,
            listino:    data.counts.listino,
            documenti:  data.counts.documenti,
          }}
        />
      ) : null}
      <div className="flex shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2">
        <DashboardHeaderSedeToolsMenu fornitoriInScadenza={data.sollecitiFornitori} />
      </div>
    </div>
  )
}

export default function OperatorDesktopWorkspaceHeader() {
  return (
    <Suspense fallback={null}>
      <OperatorDesktopWorkspaceHeaderInner />
    </Suspense>
  )
}
