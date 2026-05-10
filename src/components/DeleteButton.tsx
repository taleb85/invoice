'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { useT } from '@/lib/use-t'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import { BTN_SIZE_SM } from '@/lib/button-size-tokens'

interface Props {
  id: string
  table: string
  confirmMessage?: string
  redirectTo?: string
  /** Sostituisce le classi predefinite (es. pill compatto in tabella). */
  className?: string
  /** Classi SVG cestino / spinner (default `w-3.5 h-3.5`). */
  iconClassName?: string
  /** Nasconde l'etichetta testuale — solo icona (per righe tabella compatte). */
  iconOnly?: boolean
}

const defaultButtonClass =
  `inline-flex items-center gap-1.5 border border-[rgba(34,211,238,0.15)] bg-red-950/45 font-semibold text-red-200 shadow-sm shadow-red-950/30 ring-1 ring-inset ring-red-400/15 transition-colors hover:border-[rgba(34,211,238,0.15)] hover:bg-red-600/25 hover:text-red-50 hover:shadow-red-900/40 ${BTN_SIZE_SM}`

export default function DeleteButton({
  id,
  table,
  confirmMessage,
  redirectTo,
  className,
  iconClassName = `w-3.5 h-3.5 ${icon.destructive}`,
  iconOnly = false,
}: Props) {
  const t = useT()
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    const msg = confirmMessage ?? t.appStrings.deleteGenericConfirm
    if (!confirm(msg)) return

    setLoading(true)
    const res = await fetch('/api/delete-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ table, id }),
    })
    setLoading(false)

    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: t.appStrings.deleteFailed }))
      alert(j.error ?? t.appStrings.deleteFailed)
      return
    }

    if (redirectTo) {
      router.push(redirectTo)
    }
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      aria-label={iconOnly ? t.common.delete : undefined}
      className={`${className ?? defaultButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {loading ? (
        <Loader2 className={`animate-spin ${iconClassName}`} aria-hidden />
      ) : (
        <Trash2 className={iconClassName} aria-hidden strokeWidth={2} />
      )}
      {!iconOnly && t.common.delete}
    </button>
  )
}
