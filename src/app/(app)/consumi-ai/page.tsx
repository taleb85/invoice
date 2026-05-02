'use client'

import { useMe } from '@/lib/me-context'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/use-t'
import { BackButton } from '@/components/BackButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import GeminiUsageDashboard, { type GeminiUsageDashboardHandle } from '@/components/GeminiUsageDashboard'

export default function ConsumiAiPage() {
  const { me, loading } = useMe()
  const router = useRouter()
  const t = useT()
  const dashRef = useRef<GeminiUsageDashboardHandle>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!loading && me && !me.is_admin) router.replace('/')
  }, [me, loading, router])

  const handleRefresh = () => {
    setRefreshing(true)
    dashRef.current?.refresh()
    setTimeout(() => setRefreshing(false), 1200)
  }

  if (loading || !me?.is_admin) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-app-cyan-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="teal"
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
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
        <AppPageHeaderTitleWithDashboardShortcut>
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{t.nav.consumiAi}</h1>
          <p className={APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS}>
            Gemini 2.5 Flash-Lite — token usati, costo per scan, totale stimato
          </p>
        </AppPageHeaderTitleWithDashboardShortcut>

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

      <GeminiUsageDashboard ref={dashRef} />
    </div>
  )
}
