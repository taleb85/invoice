'use client'

import { useEffect, useState } from 'react'
import DuplicateManager from '@/components/duplicates/duplicate-manager'
import { useLocale } from '@/lib/locale-context'

type FetchState = 'idle' | 'loading' | 'done' | 'error'

export default function DuplicateDashboardBanner() {
  const { t } = useLocale()
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [total, setTotal] = useState(0)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || fetchState !== 'idle') return
    setFetchState('loading')
    fetch('/api/duplicates/detect', { cache: 'no-store' })
      .then((res) => res.json())
      .then((json: { ok?: boolean; report?: { total?: number }; error?: string }) => {
        if (json.ok && json.report != null) {
          setTotal(json.report.total ?? 0)
          setFetchState('done')
        } else {
          setFetchState('error')
        }
      })
      .catch(() => setFetchState('error'))
  }, [mounted, fetchState])

  const handleDeleted = () => {
    // Re-check after deletion
    setFetchState('idle')
  }

  if (!mounted || fetchState !== 'done' || total === 0) return null

  const bannerText = (
    total === 1 ? t.dashboard.duplicateDashboardBanner_one : t.dashboard.duplicateDashboardBanner_other
  ).replace(/\{n\}/g, String(total))

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: 'rgba(249,156,0,0.10)',
          border: '1px solid rgba(249,156,0,0.25)',
          color: '#f99c00',
        }}
        className="flex w-full touch-manipulation items-center gap-3 rounded-xl px-4 py-3 text-left transition-opacity hover:opacity-90 active:opacity-80"
      >
        <span className="shrink-0 text-base leading-none" aria-hidden>⚠️</span>
        <span className="flex-1 text-sm font-semibold">{bannerText}</span>
        <svg className="h-4 w-4 shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <DuplicateManager open={open} onOpenChange={setOpen} onDeleted={handleDeleted} />
    </>
  )
}
