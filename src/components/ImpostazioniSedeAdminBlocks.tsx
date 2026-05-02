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
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start lg:gap-6">
      <div className="flex min-w-0 flex-col gap-5 lg:col-span-7">
        <SedeOcrIgnoreNamesEditor sedeId={sedeId} initialNames={initialNames} canEdit />
        <div className="overflow-hidden rounded-2xl border border-app-line-22 bg-[#0f172b]/60">
          <div className="border-b border-app-line-22 bg-gradient-to-r from-teal-950/35 via-transparent to-transparent px-5 py-3.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-teal-200/95">{t.log.ocrDiscardRulesTitle}</p>
            <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">{t.log.ocrDiscardRulesSubtitle}</p>
          </div>
          <div className="p-5 sm:p-6">
            <OcrScartoRulesPanel sedeId={sedeId} variant="settingsPage" />
          </div>
        </div>
      </div>

      <div className="min-w-0 lg:col-span-5">
        <div className="rounded-2xl border border-app-line-22 bg-[#0f172b]/60 p-5 sm:p-6">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
              <svg className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-snug text-app-fg">{imp.approvalSectionTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">{imp.approvalSectionSubtitle}</p>
            </div>
          </div>
          <ApprovalSettingsForm sedeId={sedeId} />
        </div>
      </div>
    </div>
  )
}
