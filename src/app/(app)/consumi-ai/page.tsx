'use client'

import { useMe } from '@/lib/me-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useT } from '@/lib/use-t'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import GeminiUsageDashboard from '@/components/GeminiUsageDashboard'

export default function ConsumiAiPage() {
  const { me, loading } = useMe()
  const router = useRouter()
  const t = useT()

  useEffect(() => {
    if (!loading && me?.role !== 'admin') {
      router.replace('/')
    }
  }, [me, loading, router])

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
        <div className="min-w-0">
          <h1 className="text-base font-bold text-app-fg sm:text-lg">
            {t.nav.consumiAi}
          </h1>
          <p className="text-xs text-app-fg-muted">
            Gemini 2.5 Flash-Lite — token usati, costo per scan, totale stimato
          </p>
        </div>
      </AppPageHeaderStrip>

      <GeminiUsageDashboard />
    </div>
  )
}
