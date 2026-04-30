'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Ban } from 'lucide-react'
import { useToast } from '@/lib/toast-context'
import { useLocale } from '@/lib/locale-context'

type Props = {
  mittente: string
  sedeId: string | null | undefined
  /** Se valorizzato, dopo la blacklist il documento viene scartato (`POST /api/documenti-da-processare`). */
  documentoId?: string | null
  /** Messaggio toast successo (default: testo blacklist dal catalogo UI). */
  successMessage?: string
  /** Mostra etichetta accanto all’icona (es. tabella attività email). */
  showLabel?: boolean
}

export default function LogBlacklistIgnoreButton({
  mittente,
  sedeId,
  documentoId,
  successMessage,
  showLabel,
}: Props) {
  const { showToast } = useToast()
  const { t } = useLocale()
  const router = useRouter()
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

      const doc = documentoId?.trim()
      if (doc) {
        const sc = await fetch('/api/documenti-da-processare', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: doc, azione: 'scarta' }),
        })
        if (!sc.ok) {
          const sj = (await sc.json().catch(() => ({}))) as { error?: string }
          showToast(sj.error ?? t.log.blacklistError, 'error')
          return
        }
      }

      showToast(
        successMessage?.trim()
          ? successMessage
          : documentoId?.trim()
            ? t.log.activityIgnoreSenderDoneToast
            : t.log.activityBlacklistConfirmToast,
        'success',
      )
      router.refresh()
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
      title={t.log.activityLogIgnoreAlwaysAction}
      aria-label={t.log.activityLogIgnoreAlwaysAction}
      className={`inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md border border-rose-500/35 bg-rose-950/45 text-rose-100 transition-colors hover:border-rose-400/45 hover:bg-rose-950/70 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation ${showLabel ? 'min-w-0 px-2.5' : 'h-8 w-8'}`}
    >
      <Ban className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      {showLabel ? <span className="max-w-[11rem] truncate text-[11px] font-semibold">{t.log.activityLogIgnoreAlwaysAction}</span> : null}
    </button>
  )
}
