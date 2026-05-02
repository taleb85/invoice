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
    <div className="space-y-4">
      <SedeOcrIgnoreNamesEditor sedeId={sedeId} initialNames={initialNames} canEdit />
      <div className="rounded-2xl border border-app-line-22 bg-[#0f172b]/60 p-5">
        <OcrScartoRulesPanel sedeId={sedeId} variant="settingsPage" />
      </div>
      <div className="rounded-2xl border border-app-line-22 bg-[#0f172b]/60 p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15">
            <svg className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-app-fg">{imp.approvalSectionTitle}</p>
            <p className="text-xs text-app-fg-muted">{imp.approvalSectionSubtitle}</p>
          </div>
        </div>
        <ApprovalSettingsForm sedeId={sedeId} />
      </div>
    </div>
  )
}
