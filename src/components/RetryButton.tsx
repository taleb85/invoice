'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/use-t'

export default function RetryButton({ logId }: { logId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const t = useT()

  const handleRetry = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/retry-log/${logId}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? t.appStrings.errorGenericTitle)
      } else {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleRetry}
      disabled={loading}
      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-950/40 px-2 text-[11px] font-medium text-cyan-100 transition-colors hover:border-cyan-400/45 hover:bg-cyan-950/60 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
    >
      {loading ? (
        <>
          <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {t.log.retrying}
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {t.log.retry}
        </>
      )}
    </button>
  )
}
