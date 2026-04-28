'use client'

import { useCallback, useEffect, useState } from 'react'
import { useMe } from '@/lib/me-context'
import { useT } from '@/lib/use-t'
import { ActivityFeed } from '@/components/activity/activity-feed'
import type { ActivityLogRow } from '@/app/api/activity-log/route'
import { BackButton } from '@/components/BackButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'

type Operatore = { id: string; full_name: string | null }

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
  const [sedeId, setSedeId] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
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

  return (
    <div className="app-shell-page-padding">
      <BackButton href="/" label={t.nav.dashboard} />
      <AppPageHeaderStrip accent="indigo" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>}>
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-base font-bold text-app-fg truncate sm:text-lg">{t.appStrings.attivitaPageTitle}</h1>
            <p className="text-xs text-app-fg-muted truncate">{t.appStrings.attivitaPageSub}</p>
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
        </div>
      </AppPageHeaderStrip>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-app-line-15 px-4 py-3 sm:px-6">
        {/* Operatore filter */}
        {operatori.length > 0 && (
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="rounded-xl border border-app-line-28 bg-transparent px-3 py-1.5 text-xs font-semibold text-app-fg focus:border-[#22d3ee]/40 focus:outline-none"
          >
            <option value="">{t.appStrings.attivitaAllOperators}</option>
            {operatori.map((op) => (
              <option key={op.id} value={op.id}>
                {op.full_name ?? op.id}
              </option>
            ))}
          </select>
        )}

        {/* Date range */}
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-app-line-28 bg-transparent px-3 py-1.5 text-xs text-app-fg focus:border-[#22d3ee]/40 focus:outline-none"
          />
          <span className="text-xs text-app-fg-muted">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-app-line-28 bg-transparent px-3 py-1.5 text-xs text-app-fg focus:border-[#22d3ee]/40 focus:outline-none"
          />
        </div>

        {(userId || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { setUserId(''); setDateFrom(''); setDateTo('') }}
            className="text-xs text-app-fg-muted hover:text-rose-400"
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
        limit={30}
        showFilters={true}
      />
    </div>
  )
}
