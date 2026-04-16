'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/use-t'

export default function BollaForceListinoFromRekkiButton({
  bollaId,
  visible,
}: {
  bollaId: string
  visible: boolean
}) {
  const t = useT()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (!visible) return null

  return (
    <div className="flex flex-col items-stretch gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setMsg(null)
          setBusy(true)
          void fetch('/api/listino/forza-rekki-bolla', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ bolla_id: bollaId }),
          })
            .then(async (res) => {
              const j = (await res.json().catch(() => ({}))) as { error?: string; inserted?: number }
              if (!res.ok) {
                setMsg(j.error ?? t.appStrings.listinoForceUpdateFromDocError)
                return
              }
              setMsg(t.appStrings.listinoForceUpdateFromDocDone.replace('{n}', String(j.inserted ?? 0)))
              router.refresh()
            })
            .catch(() => setMsg(t.appStrings.listinoForceUpdateFromDocError))
            .finally(() => setBusy(false))
        }}
        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-violet-400/50 bg-violet-950/60 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-100 shadow-[0_0_12px_rgba(139,92,246,0.35)] transition-colors hover:bg-violet-800/50 disabled:opacity-45 sm:text-[11px]"
      >
        {busy ? t.appStrings.listinoForceUpdateFromDocWorking : t.appStrings.listinoForceUpdateFromDocButton}
      </button>
      {msg ? <p className="max-w-[14rem] text-[10px] leading-snug text-app-fg-muted">{msg}</p> : null}
    </div>
  )
}
