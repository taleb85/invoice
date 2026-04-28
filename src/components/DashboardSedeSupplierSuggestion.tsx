'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { AppSheet } from '@/components/ui/AppSheet'
import { createClient } from '@/utils/supabase/client'
import type { SedeSupplierSuggestionItem } from '@/lib/suggested-fornitore'
import { useT } from '@/lib/use-t'
import { useToast } from '@/lib/toast-context'

type Props = {
  sedeId: string
  items: SedeSupplierSuggestionItem[]
}

export default function DashboardSedeSupplierSuggestion({ sedeId, items }: Props) {
  const router = useRouter()
  const t = useT()
  const { showToast } = useToast()
  const supabase = createClient()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [ignoringId, setIgnoringId] = useState<string | null>(null)
  const [errorByDoc, setErrorByDoc] = useState<Record<string, string | undefined>>({})

  const count = items.length

  const bannerLine = useMemo(() => {
    return count === 1
      ? t.dashboard.suggestedSupplierBannerTeaser_one
      : t.dashboard.suggestedSupplierBannerTeaser_many.replace(/\{n\}/g, String(count))
  }, [count, t.dashboard])

  const dismissDocument = async (documentoId: string) => {
    setIgnoringId(documentoId)
    try {
      const res = await fetch('/api/sede/supplier-suggestion', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sede_id: sedeId, document_id: documentoId }),
      })
      if (!res.ok) {
        showToast((await res.json().catch(() => ({}))).error ?? t.ui.networkError, 'error')
        return
      }
      router.refresh()
    } catch {
      showToast(t.ui.networkError, 'error')
    } finally {
      setIgnoringId(null)
    }
  }

  const confirmAdd = async (item: SedeSupplierSuggestionItem) => {
    const docId = item.documentoId
    const prefill = item.prefill

    setSavingId(docId)
    setErrorByDoc((prev) => ({ ...prev, [docId]: undefined }))

    const { data: row, error: insertErr } = await supabase
      .from('fornitori')
      .insert([
        {
          nome: prefill.nome.trim(),
          display_name: null,
          email: prefill.email,
          piva: prefill.piva,
          indirizzo: prefill.indirizzo?.trim() ?? null,
          sede_id: sedeId,
        },
      ])
      .select('id')
      .single()

    if (insertErr || !row?.id) {
      setSavingId(null)
      const msg = insertErr?.message ?? t.ui.networkError
      setErrorByDoc((prev) => ({ ...prev, [docId]: msg }))
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

    setSavingId(null)
    showToast(t.dashboard.suggestedSupplierSavedToast, 'success')
    router.refresh()
  }

  const actionDims =
    'inline-flex h-9 min-h-9 shrink-0 items-center justify-center rounded-lg px-3 text-xs font-semibold leading-none'

  const formatContact = (dateString: string | null) => {
    if (!dateString) return '—'
    const d = new Date(dateString)
    if (!Number.isFinite(d.getTime())) return '—'
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="w-full text-left transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(15,23,42,0.95)] rounded-sm"
      >
        <p className="min-w-0 text-sm font-semibold leading-snug text-app-fg">{bannerLine}</p>
      </button>

      <AppSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title={t.dashboard.suggestedSupplierDrawerTitle}
        closeLabel={t.dashboard.emailSyncDismiss}
        scrimCloseLabel={t.dashboard.suggestedSupplierDrawerCloseScrimAria}
        size="wide"
      >
        <div className="space-y-3 p-4 sm:p-5">
          {items.map((item) => {
            const sender = item.mittente?.trim() || '—'
            const err = errorByDoc[item.documentoId]
            const saving = savingId === item.documentoId
            const ignoring = ignoringId === item.documentoId

            return (
              <div
                key={item.documentoId}
                className="rounded-xl border border-app-line-32 bg-white/[0.04] p-4 shadow-sm shadow-black/20"
              >
                <p className="text-sm font-semibold leading-snug text-app-fg">{item.displayName}</p>
                <dl className="mt-2 space-y-1 text-xs text-app-fg-muted">
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                    <dt className="font-medium text-app-fg-muted/90">{t.dashboard.suggestedSupplierSenderLabel}</dt>
                    <dd className="min-w-0 break-all font-mono text-[11px] text-app-fg-muted">{sender}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                    <dt className="font-medium text-app-fg-muted/90">{t.dashboard.suggestedSupplierFirstContactLabel}</dt>
                    <dd className="tabular-nums">{formatContact(item.createdAt)}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void confirmAdd(item)}
                    disabled={saving}
                    aria-busy={saving}
                    className={`${actionDims} border border-violet-300/35 bg-violet-500 text-white shadow-md shadow-violet-950/40 transition-colors hover:border-violet-200/45 hover:bg-violet-400 disabled:pointer-events-none disabled:opacity-60`}
                  >
                    {saving ? t.fornitori.saving : t.dashboard.suggestedSupplierConfirm}
                  </button>
                  <Link
                    href={item.newFornitoreHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${actionDims} border border-[rgba(34,211,238,0.15)] bg-violet-950/30 text-violet-200 transition-colors hover:border-[rgba(34,211,238,0.2)] hover:bg-violet-900/35 hover:text-white`}
                  >
                    {t.dashboard.suggestedSupplierOpenForm}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void dismissDocument(item.documentoId)}
                    disabled={ignoring}
                    aria-busy={ignoring}
                    className={`${actionDims} border border-transparent text-app-fg-muted transition-colors hover:bg-white/[0.06] hover:text-app-fg disabled:pointer-events-none disabled:opacity-50`}
                  >
                    {ignoring ? t.fornitori.saving : t.dashboard.suggestedSupplierIgnore}
                  </button>
                </div>
                {err ? (
                  <p className="mt-2 text-[11px] text-red-300/95" role="alert">
                    {err}
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      </AppSheet>
    </>
  )
}
