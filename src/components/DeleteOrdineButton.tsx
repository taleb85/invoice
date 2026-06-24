'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteOrdineButton({ id }: { id: string }) {
  const [confirm, setConfirm] = useState(false)
  const [working, setWorking] = useState(false)
  const router = useRouter()

  const handleDelete = useCallback(async () => {
    setWorking(true)
    try {
      const res = await fetch('/api/conferme-ordine/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        alert(j.error ?? 'Errore durante l\'eliminazione')
        setWorking(false)
        setConfirm(false)
        return
      }
      setConfirm(false)
      router.refresh()
    } catch {
      alert('Errore di rete')
      setWorking(false)
      setConfirm(false)
    }
  }, [id, router])

  if (confirm) {
    return (
      <span className="inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={handleDelete}
          disabled={working}
          className="inline-flex h-7 items-center justify-center rounded-lg border border-red-500/40 bg-red-950/40 px-2 text-[10px] font-semibold text-red-200 transition-colors hover:bg-red-950/60 disabled:opacity-50"
        >
          {working ? '…' : 'Conferma'}
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          disabled={working}
          className="inline-flex h-7 items-center justify-center rounded-lg border border-app-line-30 bg-app-line-10 px-2 text-[10px] font-semibold text-app-fg-muted transition-colors hover:bg-app-line-20 disabled:opacity-50"
        >
          No
        </button>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-app-line-30 bg-app-line-10 text-app-fg-muted transition-colors hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-300 touch-manipulation"
      title="Elimina ordine"
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  )
}
