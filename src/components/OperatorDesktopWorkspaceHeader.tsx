'use client'

import { Suspense, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useLocale } from '@/lib/locale-context'
import { normalizeAppPath } from '@/lib/mobile-hub-routes'
import type { OperatorWorkspaceHeaderPayload } from '@/types/operator-workspace-header'
import DashboardWorkspaceQuickNav from '@/components/DashboardWorkspaceQuickNav'
import DashboardHeaderSedeToolsMenu from '@/components/DashboardHeaderSedeToolsMenu'

function OperatorDesktopWorkspaceHeaderInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useLocale()
  const normalized = normalizeAppPath(pathname ?? '')
  const hideStrip = normalized.startsWith('/fornitori')
  const fyRaw = searchParams?.get('fy')?.trim() ?? ''
  const fyQuery = fyRaw ? `fy=${encodeURIComponent(fyRaw)}` : ''

  const [data, setData] = useState<OperatorWorkspaceHeaderPayload | null>(null)

  useEffect(() => {
    if (hideStrip) {
      setData(null)
      return
    }
    const ac = new AbortController()
    ;(async () => {
      try {
        const url = fyQuery ? `/api/operator-workspace-header?${fyQuery}` : '/api/operator-workspace-header'
        const res = await fetch(url, { signal: ac.signal, cache: 'no-store' })
        if (!res.ok) return
        const json = (await res.json()) as OperatorWorkspaceHeaderPayload
        if (!ac.signal.aborted) setData(json)
      } catch {
        /* ignore abort */
      }
    })()
    return () => ac.abort()
  }, [hideStrip, fyQuery])

  if (hideStrip) return null
  if (!data) return null

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
            ordini: data.counts.ordini,
            bolle: data.counts.bolle,
            fatture: data.counts.fatture,
            statements: data.counts.statements,
            listino: data.counts.listino,
            documenti: data.counts.documenti,
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
