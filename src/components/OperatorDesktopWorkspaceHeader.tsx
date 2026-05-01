'use client'

import { Suspense } from 'react'
import useSWR from 'swr'
import { usePathname, useSearchParams } from 'next/navigation'
import { normalizeAppPath } from '@/lib/mobile-hub-routes'
import type { OperatorWorkspaceHeaderPayload } from '@/types/operator-workspace-header'
import DashboardHeaderSedeToolsMenu from '@/components/DashboardHeaderSedeToolsMenu'

const headerFetcher = (url: string): Promise<OperatorWorkspaceHeaderPayload | null> =>
  fetch(url).then((r) => (r.ok ? r.json() : null))

function useOperatorWorkspaceToolsPayload(): {
  data: OperatorWorkspaceHeaderPayload | null | undefined
  visible: boolean
} {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const normalized = normalizeAppPath(pathname ?? '')
  const hideStrip = normalized.startsWith('/fornitori')
  const fyRaw = searchParams?.get('fy')?.trim() ?? ''
  const fyQuery = fyRaw ? `fy=${encodeURIComponent(fyRaw)}` : ''

  const swrKey = hideStrip
    ? null
    : fyQuery
      ? `/api/operator-workspace-header?${fyQuery}`
      : '/api/operator-workspace-header'

  const { data } = useSWR<OperatorWorkspaceHeaderPayload | null>(swrKey, headerFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 20_000,
    refreshInterval: 60_000,
  })

  const visible = !hideStrip && !!data?.operatorScoped
  return { data, visible }
}

/**
 * Solo menu (solleciti / strumenti / sync): da incollare nella `AppPageHeaderStrip` (es. dashboard).
 */
export function OperatorWorkspaceToolsToolbar({ className }: { className?: string }) {
  return (
    <Suspense fallback={null}>
      <OperatorWorkspaceToolsToolbarInner className={className} />
    </Suspense>
  )
}

function OperatorWorkspaceToolsToolbarInner({ className }: { className?: string }) {
  const { data, visible } = useOperatorWorkspaceToolsPayload()
  if (!visible || !data) return null

  return (
    <div className={className}>
      <DashboardHeaderSedeToolsMenu
        fornitoriInScadenza={data.sollecitiFornitori}
        lastImapSyncAt={data.lastImapSyncAt ?? null}
        lastImapSyncError={data.lastImapSyncError ?? null}
      />
    </div>
  )
}
