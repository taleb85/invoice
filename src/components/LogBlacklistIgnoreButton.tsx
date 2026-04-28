'use client'

import { useState } from 'react'
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
      className="rounded border border-red-500/35 bg-red-950/40 px-2 py-0.5 text-[11px] font-medium text-red-100 hover:bg-red-950/65 disabled:opacity-50"
    >
      🚫 {t.log.logIgnoreAlways}
    </button>
  )
}
