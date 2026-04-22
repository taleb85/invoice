'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { useT } from '@/lib/use-t'
import type { ActivityLogRow } from '@/app/api/activity-log/route'
import { activityColor } from '@/lib/activity-logger'
import type { ActivityAction } from '@/lib/activity-logger'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'adesso'
  if (mins < 60) return `${mins} minut${mins === 1 ? 'o' : 'i'} fa`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} or${hrs === 1 ? 'a' : 'e'} fa`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'ieri'
  if (days < 7) return `${days} giorni fa`
  return new Date(dateStr).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
}

const COLOR_DOT: Record<ReturnType<typeof activityColor>, string> = {
  green: 'bg-emerald-400',
  red: 'bg-rose-400',
  blue: 'bg-blue-400',
  amber: 'bg-amber-400',
  purple: 'bg-violet-400',
  gray: 'bg-app-fg-muted',
}
const COLOR_BADGE: Record<ReturnType<typeof activityColor>, string> = {
  green: 'bg-emerald-400/10 text-emerald-400',
  red: 'bg-rose-400/10 text-rose-400',
  blue: 'bg-blue-400/10 text-blue-400',
  amber: 'bg-amber-400/10 text-amber-400',
  purple: 'bg-violet-400/10 text-violet-400',
  gray: 'bg-app-line-15 text-app-fg-muted',
}

type FilterChip = 'all' | 'bolle' | 'fatture' | 'documenti' | 'operatori'
const FILTER_CHIP_ACTIONS: Record<FilterChip, string[]> = {
  all: [],
  bolle: ['bolla.created', 'bolla.deleted'],
  fatture: ['fattura.created', 'fattura.deleted', 'fattura.associated', 'fattura.approved', 'fattura.rejected'],
  documenti: ['documento.processed', 'documento.discarded', 'email.synced'],
  operatori: ['operatore.created', 'operatore.pin_changed', 'fornitore.created', 'fornitore.updated'],
}

type Props = {
  sedeId?: string | null
  userId?: string | null
  fornitoreId?: string | null
  limit?: number
  showFilters?: boolean
  compact?: boolean
}

type FeedResponse = {
  activities: ActivityLogRow[]
  total: number
  page: number
}

const fetcher = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error('error'))))

export function ActivityFeed({ sedeId, userId, fornitoreId, limit = 20, showFilters = false, compact = false }: Props) {
  const t = useT()
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all')
  const [page, setPage] = useState(1)
  const [allRows, setAllRows] = useState<ActivityLogRow[]>([])
  const [hasMore, setHasMore] = useState(false)

  const buildUrl = useCallback(
    (p: number) => {
      const params = new URLSearchParams({ limit: String(limit), page: String(p) })
      if (sedeId) params.set('sede_id', sedeId)
      if (userId) params.set('user_id', userId)
      if (fornitoreId) params.set('fornitore_id', fornitoreId)
      const chipActions = FILTER_CHIP_ACTIONS[activeFilter] ?? []
      if (chipActions.length === 1) params.set('action', chipActions[0]!)
      return `/api/activity-log?${params}`
    },
    [sedeId, userId, fornitoreId, limit, activeFilter],
  )

  const { data, isLoading, error } = useSWR<FeedResponse>(buildUrl(1), fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: false,
  })

  // Reset rows when filter changes
  const prevFilter = useRef(activeFilter)
  useEffect(() => {
    if (prevFilter.current !== activeFilter) {
      prevFilter.current = activeFilter
      setPage(1)
      setAllRows([])
    }
  }, [activeFilter])

  useEffect(() => {
    if (!data) return
    if (page === 1) {
      setAllRows(data.activities)
    }
    setHasMore(data.activities.length + (page - 1) * limit < data.total)
  }, [data, page, limit])

  const loadMore = useCallback(async () => {
    const nextPage = page + 1
    try {
      const res = await fetch(buildUrl(nextPage))
      if (!res.ok) return
      const d = (await res.json()) as FeedResponse
      setAllRows((prev) => [...prev, ...d.activities])
      setPage(nextPage)
      setHasMore(allRows.length + d.activities.length < d.total)
    } catch {
      // ignore
    }
  }, [page, buildUrl, allRows.length])

  // For compact mode: apply client-side action filter
  const filterLabels: Record<FilterChip, string> = {
    all: t.appStrings.attivitaFilterAll,
    bolle: t.appStrings.attivitaFilterBolle,
    fatture: t.appStrings.attivitaFilterFatture,
    documenti: t.appStrings.attivitaFilterDocumenti,
    operatori: t.appStrings.attivitaFilterOperatori,
  }

  const displayedRows = (() => {
    const chipActions = FILTER_CHIP_ACTIONS[activeFilter] ?? []
    if (chipActions.length === 0) return allRows
    return allRows.filter((r) => chipActions.includes(r.action))
  })()

  return (
    <div className="flex flex-col gap-3">
      {/* Filter chips */}
      {showFilters && (
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(FILTER_CHIP_ACTIONS) as FilterChip[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveFilter(id)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                activeFilter === id
                  ? 'bg-[#22d3ee]/15 text-[#22d3ee] ring-1 ring-[#22d3ee]/30'
                  : 'bg-app-line-10 text-app-fg-muted hover:bg-app-line-15 hover:text-app-fg'
              }`}
            >
              {filterLabels[id]}
            </button>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && allRows.length === 0 && (
        <div className="space-y-3">
          {[...Array(compact ? 3 : 5)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="mt-1 h-2 w-2 shrink-0 animate-pulse rounded-full bg-app-line-22" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-3/4 animate-pulse rounded bg-app-line-15" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-app-line-10" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-rose-400">{t.appStrings.attivitaError}</p>
      )}

      {/* Empty state */}
      {!isLoading && !error && displayedRows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <svg className="h-8 w-8 text-app-fg-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium text-app-fg-muted">{t.appStrings.attivitaNoRecent}</p>
        </div>
      )}

      {/* Timeline */}
      {displayedRows.length > 0 && (
        <div className="relative space-y-0">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-app-line-15" aria-hidden />

          {displayedRows.map((row, idx) => {
            const color = activityColor(row.action as ActivityAction)
            return (
              <div key={row.id} className={`relative flex gap-3 ${idx > 0 ? 'pt-3' : ''}`}>
                {/* Dot */}
                <div className={`relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[#0f172b] ${COLOR_DOT[color]}`} />

                {/* Content */}
                <div className="min-w-0 flex-1 pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5">
                    <div className="min-w-0">
                      <span
                        className={`mr-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${COLOR_BADGE[color]}`}
                      >
                        {row.actionIcon} {row.actionLabel}
                      </span>
                      {row.entityLabel && !compact && (
                        <span className="text-xs text-app-fg-muted">· {row.entityLabel}</span>
                      )}
                    </div>
                    <time className="shrink-0 text-[10px] text-app-fg-muted">{timeAgo(row.createdAt)}</time>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-app-fg-muted">
                    {row.actorName && <span className="font-medium text-app-fg">{row.actorName}</span>}
                    {row.sedeNome && !compact && <span>· {row.sedeNome}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Load more */}
      {hasMore && !compact && (
        <button
          type="button"
          onClick={() => void loadMore()}
          className="mt-1 rounded-xl border border-app-line-22 px-4 py-2 text-xs font-semibold text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg"
        >
          Carica altri
        </button>
      )}
    </div>
  )
}
