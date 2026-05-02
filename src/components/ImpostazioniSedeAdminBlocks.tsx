'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLocale } from '@/lib/locale-context'
import SedeOcrIgnoreNamesEditor from '@/components/SedeOcrIgnoreNamesEditor'
import OcrScartoRulesPanel from '@/components/OcrScartoRulesPanel'
import { ApprovalSettingsForm } from '@/components/approval/approval-settings-form'

/**
 * Blocchi legati alla sede effettiva: nomi OCR, regole scarto documenti, approvazione fatture.
 */
export default function ImpostazioniSedeAdminBlocks({ sedeId }: { sedeId: string }) {
  const { t } = useLocale()
  const imp = t.impostazioni
  const [initialNames, setInitialNames] = useState<string[] | null>(null)
  const [loadErr, setLoadErr] = useState(false)

  useEffect(() => {
    let cancelled = false
    setInitialNames(null)
    setLoadErr(false)
    ;(async () => {
      try {
        const res = await fetch(`/api/sedi/${encodeURIComponent(sedeId)}`, { credentials: 'include' })
        const j = (await res.json()) as { nomi_cliente_da_ignorare?: unknown; error?: string }
        if (!res.ok) throw new Error(j.error ?? 'load')
        const raw = j.nomi_cliente_da_ignorare
        const arr = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
        if (!cancelled) setInitialNames(arr.length ? arr : [])
      } catch {
        if (!cancelled) {
          setLoadErr(true)
          setInitialNames([])
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [sedeId])

  if (loadErr) {
    return (
      <p className="text-sm text-rose-300">
        {imp.sedeScopedConfigLoadErr}{' '}
        <Link href={`/sedi/${encodeURIComponent(sedeId)}`} className="underline">
          Scheda sede
        </Link>
      </p>
    )
  }

  if (initialNames === null) {
    return <p className="text-sm text-app-fg-muted">…</p>
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col gap-8">
      <SedeOcrIgnoreNamesEditor sedeId={sedeId} initialNames={initialNames} canEdit />

      <div className="app-card min-h-0 min-w-0 overflow-hidden">
        <div className="flex items-start gap-4 app-workspace-inset-bg-soft p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/12 ring-1 ring-teal-500/25">
            <svg className="h-5 w-5 text-teal-300/95" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">OCR</p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-app-fg">{t.log.ocrDiscardRulesTitle}</p>
            <p className="mt-1 text-xs leading-snug text-app-fg-muted">{t.log.ocrDiscardRulesSubtitle}</p>
          </div>
        </div>
        <div className="border-t border-app-line-30 app-workspace-inset-bg-soft p-5">
          <OcrScartoRulesPanel sedeId={sedeId} variant="settingsPage" />
        </div>
      </div>

      <div className="app-card min-h-0 min-w-0 overflow-hidden">
        <div className="flex items-start gap-4 app-workspace-inset-bg-soft p-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 ring-1 ring-amber-500/25">
            <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{imp.approvalSectionTitle}</p>
            <p className="mt-1 text-xs leading-snug text-app-fg-muted">{imp.approvalSectionSubtitle}</p>
          </div>
        </div>
        <div className="border-t border-app-line-30 app-workspace-inset-bg-soft p-5">
          <ApprovalSettingsForm sedeId={sedeId} />
        </div>
      </div>
    </div>
  )
}
