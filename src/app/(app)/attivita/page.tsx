'use client'

import { useCallback, useEffect, useState } from 'react'
import { useMe } from '@/lib/me-context'
import { useT } from '@/lib/use-t'
import { ActivityFeed, ACTIVITY_FEED_CATEGORY_ORDER, type ActivityFeedCategoryFilter } from '@/components/activity/activity-feed'
import type { ActivityLogRow } from '@/app/api/activity-log/route'
import { BackButton } from '@/components/BackButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { APP_PAGE_HEADER_STRIP_H1_CLASS, APP_SEGMENT_CHIP_CONTROL_CLASS, APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'

type Operatore = { id: string; full_name: string | null }

type AttivitaPeriodPreset =
  | ''
  | 'today'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'custom'

function toISODateLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function rangeForAttivitaPeriodPreset(preset: AttivitaPeriodPreset): { from: string; to: string } {
  const today = startOfLocalDay(new Date())
  switch (preset) {
    case 'today':
      return { from: toISODateLocal(today), to: toISODateLocal(today) }
    case 'last7': {
      const from = new Date(today)
      from.setDate(from.getDate() - 6)
      return { from: toISODateLocal(from), to: toISODateLocal(today) }
    }
    case 'last30': {
      const from = new Date(today)
      from.setDate(from.getDate() - 29)
      return { from: toISODateLocal(from), to: toISODateLocal(today) }
    }
    case 'thisMonth': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: toISODateLocal(from), to: toISODateLocal(today) }
    }
    case 'lastMonth': {
      const firstThis = new Date(today.getFullYear(), today.getMonth(), 1)
      const lastPrev = new Date(firstThis)
      lastPrev.setDate(0)
      const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1)
      return { from: toISODateLocal(firstPrev), to: toISODateLocal(lastPrev) }
    }
    case 'thisYear': {
      const from = new Date(today.getFullYear(), 0, 1)
      return { from: toISODateLocal(from), to: toISODateLocal(today) }
    }
    default:
      return { from: '', to: '' }
  }
}

function downloadCsv(rows: ActivityLogRow[]) {
  const header = ['Data', 'Azione', 'Attore', 'Tipo entità', 'Etichetta', 'Sede']
  const lines = rows.map((r) => [
    new Date(r.createdAt).toLocaleString('it-IT'),
    r.actionLabel,
    r.actorName ?? '',
    r.entityType,
    r.entityLabel ?? '',
    r.sedeNome ?? '',
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `attivita-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AttivitaPage() {
  const { me, loading } = useMe()
  const t = useT()
  const [sedeId] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [periodPreset, setPeriodPreset] = useState<AttivitaPeriodPreset>('')
  const [categoryFilter, setCategoryFilter] = useState<ActivityFeedCategoryFilter>('all')
  const [operatori, setOperatori] = useState<Operatore[]>([])
  const [exporting, setExporting] = useState(false)

  const isMaster = me?.is_admin
  const isAdminSede = me?.is_admin_sede

  // Load operatori list for user filter
  useEffect(() => {
    if (!isMaster && !isAdminSede) return
    const sedeFilter = !isMaster && me?.sede_id ? me.sede_id : ''
    const url = sedeFilter
      ? `/api/operators-for-sede?sede_id=${encodeURIComponent(sedeFilter)}`
      : `/api/operators-for-sede`
    fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Operatore[] | { operators?: Operatore[] }) =>
        setOperatori(Array.isArray(d) ? d : (d.operators ?? []))
      )
      .catch(() => {})
  }, [isMaster, isAdminSede, me?.sede_id])

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams({ limit: '500', page: '1' })
      if (sedeId) params.set('sede_id', sedeId)
      if (userId) params.set('user_id', userId)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      const res = await fetch(`/api/activity-log?${params}`)
      if (!res.ok) return
      const d = (await res.json()) as { activities: ActivityLogRow[] }
      downloadCsv(d.activities)
    } finally {
      setExporting(false)
    }
  }, [sedeId, userId, dateFrom, dateTo])

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-app-cyan-500 border-t-transparent" />
      </div>
    )
  }

  if (!isMaster && !isAdminSede) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-app-fg-muted">Accesso negato.</p>
      </div>
    )
  }

  const categoryLabels: Record<ActivityFeedCategoryFilter, string> = {
    all: t.appStrings.attivitaFilterAll,
    bolle: t.appStrings.attivitaFilterBolle,
    fatture: t.appStrings.attivitaFilterFatture,
    documenti: t.appStrings.attivitaFilterDocumenti,
    operatori: t.appStrings.attivitaFilterOperatori,
  }

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="teal"
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>}
      >
        <div className="min-w-0">
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{t.appStrings.attivitaPageTitle}</h1>
          <p className="mt-0.5 text-xs text-app-fg-muted truncate sm:text-sm">{t.appStrings.attivitaPageSub}</p>
        </div>
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={exporting}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-app-line-25 px-3 py-1.5 text-xs font-semibold text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg disabled:opacity-50"
        >
          {exporting ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          )}
          {t.appStrings.attivitaExportCsv}
        </button>
      </AppPageHeaderStrip>

      {/* Filters — ritmo verticale e altezze allineate ai chip segment */}
      <div className="mt-1 flex flex-wrap items-center gap-3 border-b border-app-line-15 px-4 py-3.5 sm:mt-1.5 sm:gap-3.5 sm:px-6 sm:py-4 md:gap-4">
        {/* Operatore filter */}
        {operatori.length > 0 && (
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="min-h-10 rounded-xl border border-app-line-28 bg-transparent px-3 py-2 text-sm font-semibold text-app-fg focus:border-[#22d3ee]/40 focus:outline-none"
          >
            <option value="">{t.appStrings.attivitaAllOperators}</option>
            {operatori.map((op) => (
              <option key={op.id} value={op.id}>
                {op.full_name ?? op.id}
              </option>
            ))}
          </select>
        )}

        {/* Date range — preset or custom */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={periodPreset}
            onChange={(e) => {
              const v = e.target.value as AttivitaPeriodPreset
              setPeriodPreset(v)
              if (v === 'custom') return
              const { from, to } = rangeForAttivitaPeriodPreset(v)
              setDateFrom(from)
              setDateTo(to)
            }}
            className="min-w-[12.5rem] min-h-10 rounded-xl border border-app-line-28 bg-transparent px-3 py-2 text-sm font-semibold text-app-fg focus:border-[#22d3ee]/40 focus:outline-none"
          >
            <option value="">{t.appStrings.attivitaPeriodAll}</option>
            <option value="today">{t.appStrings.attivitaPeriodToday}</option>
            <option value="last7">{t.appStrings.attivitaPeriodLast7Days}</option>
            <option value="last30">{t.appStrings.attivitaPeriodLast30Days}</option>
            <option value="thisMonth">{t.appStrings.attivitaPeriodThisMonth}</option>
            <option value="lastMonth">{t.appStrings.attivitaPeriodLastMonth}</option>
            <option value="thisYear">{t.appStrings.attivitaPeriodThisYear}</option>
            <option value="custom">{t.appStrings.attivitaPeriodCustom}</option>
          </select>
          {periodPreset === 'custom' && (
            <>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="min-h-10 rounded-xl border border-app-line-28 bg-transparent px-3 py-2 text-sm text-app-fg focus:border-[#22d3ee]/40 focus:outline-none"
              />
              <span className="self-center text-sm text-app-fg-muted">–</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="min-h-10 rounded-xl border border-app-line-28 bg-transparent px-3 py-2 text-sm text-app-fg focus:border-[#22d3ee]/40 focus:outline-none"
              />
            </>
          )}
        </div>

        {/* Categoria attività */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {ACTIVITY_FEED_CATEGORY_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategoryFilter(id)}
              className={`${APP_SEGMENT_CHIP_CONTROL_CLASS} min-h-10 px-3.5 py-2 text-sm ${
                categoryFilter === id
                  ? 'bg-[#22d3ee]/15 text-[#22d3ee] ring-1 ring-[#22d3ee]/30'
                  : 'bg-app-line-10 text-app-fg-muted hover:bg-app-line-15 hover:text-app-fg'
              }`}
            >
              {categoryLabels[id]}
            </button>
          ))}
        </div>

        {(userId || periodPreset !== '' || categoryFilter !== 'all') && (
          <button
            type="button"
            onClick={() => { setUserId(''); setDateFrom(''); setDateTo(''); setPeriodPreset(''); setCategoryFilter('all') }}
            className="min-h-10 shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-rose-400"
          >
            {t.appStrings.attivitaRemoveFilters}
          </button>
        )}
      </div>

      {/* Feed */}
      <ActivityFeed
        sedeId={sedeId || (isMaster ? undefined : me?.sede_id)}
        userId={userId || undefined}
        dateFrom={dateFrom || undefined}
        dateTo={dateTo || undefined}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        limit={30}
      />
    </div>
  )
}
