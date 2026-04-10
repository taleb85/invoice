'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RetryButton({ logId }: { logId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRetry = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/retry-log/${logId}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? 'Si è verificato un errore. Riprovare.')
      } else {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {loading ? (
        <>
          <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Riprovando…
        </>
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Riprova
        </>
      )}
    </button>
  )
}
