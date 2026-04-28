'use client'

import { useState } from 'react'
import { Ban } from 'lucide-react'
import { useToast } from '@/lib/toast-context'
import { useLocale } from '@/lib/locale-context'

type Props = {
  mittente: string
  sedeId: string | null | undefined
}

export default function LogBlacklistIgnoreButton({ mittente, sedeId }: Props) {
  const { showToast } = useToast()
  const { t } = useLocale()
  const [busy, setBusy] = useState(false)

  if (!sedeId?.trim()) return null

  const onClick = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/email-blacklist', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mittente,
          motivo: 'non_fornitore',
          sede_id: sedeId,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        showToast(j.error ?? t.log.blacklistError, 'error')
        return
      }
      showToast(t.log.logBlacklistAdded, 'success')
    } catch {
      showToast(t.log.blacklistError, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void onClick()}
      title={t.log.logIgnoreAlways}
      aria-label={t.log.logIgnoreAlways}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-rose-500/35 bg-rose-950/45 text-rose-100 transition-colors hover:border-rose-400/45 hover:bg-rose-950/70 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation"
    >
      <Ban className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
    </button>
  )
}
