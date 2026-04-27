'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { SedeSupplierPrefill } from '@/lib/suggested-fornitore'
import { useT } from '@/lib/use-t'
import { useToast } from '@/lib/toast-context'

type Props = {
  sedeId: string
  prefill: SedeSupplierPrefill
  newFornitoreHref: string
}

export default function DashboardSedeSupplierSuggestion({ sedeId, prefill, newFornitoreHref }: Props) {
  const router = useRouter()
  const t = useT()
  const { showToast } = useToast()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmAdd = async () => {
    setSaving(true)
    setError(null)

    const { data: row, error: insertErr } = await supabase
      .from('fornitori')
      .insert([
        {
          nome: prefill.nome.trim(),
          display_name: null,
          email: prefill.email,
          piva: prefill.piva,
          indirizzo: prefill.indirizzo?.trim() || null,
          sede_id: sedeId,
        },
      ])
      .select('id')
      .single()

    if (insertErr || !row?.id) {
      setSaving(false)
      const msg = insertErr?.message ?? t.ui.networkError
      setError(msg)
      showToast(msg, 'error')
      return
    }

    const emailNorm = prefill.email?.trim().toLowerCase()
    if (emailNorm?.includes('@')) {
      await fetch('/api/fornitore-emails/remember', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fornitore_id: row.id, email: emailNorm }),
      })
    }

    setSaving(false)
    showToast(t.dashboard.suggestedSupplierSavedToast, 'success')
    router.refresh()
  }

  const actionDims =
    'inline-flex h-9 min-h-9 shrink-0 items-center justify-center rounded-lg px-3 text-xs font-semibold leading-none'

  return (
    <div className="flex w-fit max-w-full shrink-0 flex-col items-end gap-1">
      <div className="flex w-fit max-w-full flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => void confirmAdd()}
          disabled={saving}
          aria-busy={saving}
          className={`${actionDims} border border-violet-300/35 bg-violet-500 text-white shadow-md shadow-violet-950/40 transition-colors hover:bg-violet-400 hover:border-violet-200/45 disabled:pointer-events-none disabled:opacity-60`}
        >
          {saving ? t.fornitori.saving : t.dashboard.suggestedSupplierConfirm}
        </button>
        <Link
          href={newFornitoreHref}
          className={`${actionDims} border border-[rgba(34,211,238,0.15)] bg-violet-950/30 text-violet-200 transition-colors hover:border-[rgba(34,211,238,0.2)] hover:bg-violet-900/35 hover:text-white`}
        >
          {t.dashboard.suggestedSupplierOpenForm}
        </Link>
      </div>
      {error && (
        <p className="max-w-[min(22rem,calc(100vw-6rem))] text-right text-[11px] text-red-300/95" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
