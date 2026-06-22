'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '@/lib/locale-context'
import { useMe } from '@/lib/me-context'
import { useToast } from '@/lib/toast-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsAdminSedeUi, effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { BackButton } from '@/components/BackButton'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'

import {
  FILE_ATTACHMENT_RETENTION_UI_ENABLED,
  FILE_ATTACHMENT_RETENTION_DAYS,
} from '@/lib/file-retention-config'

interface SedeRow {
  id: string
  nome: string
  imap_user: string | null
  imap_host: string | null
  country_code: string | null
  operatori_count: number
  fornitori_count: number
  file_retention_policy: string | null
}

function FileRetentionListToggle({
  sedeId,
  policy,
  onUpdated,
}: {
  sedeId: string
  policy: string | null
  onUpdated: () => void
}) {
  const { t } = useLocale()
  const { showToast } = useToast()
  const effectivePolicy = policy ?? 'keep'
  const active = effectivePolicy !== 'keep'
  const [busy, setBusy] = useState(false)

  const onToggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (busy) return
    const nextActive = !active
    setBusy(true)
    try {
      const body: Record<string, unknown> = {
        file_retention_policy: nextActive ? 'delete_only' : 'keep',
      }
      if (nextActive) {
        body.file_retention_days = FILE_ATTACHMENT_RETENTION_DAYS
      }
      const res = await fetch(`/api/sedi/${encodeURIComponent(sedeId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        showToast(j.error ?? t.common.error, 'error')
        return
      }
      onUpdated()
    } catch {
      showToast(t.common.error, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="group"
      className="flex items-center justify-between gap-3 border-t border-app-line-15 px-4 py-2.5 app-workspace-inset-bg-soft"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="min-w-0 flex-1 text-[11px] font-medium leading-snug text-app-fg-muted">
        {t.sedi.fileRetentionListToggle}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={active}
        disabled={busy}
        aria-busy={busy}
        onClick={(e) => void onToggle(e)}
        className={`relative inline-flex h-7 w-11 shrink-0 cursor-pointer rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 disabled:cursor-not-allowed disabled:opacity-50 ${
          active ? 'border-cyan-400/45 bg-cyan-500/25' : 'border-app-line-25 bg-app-line-15'
        }`}
      >
        <span
          className={`pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/10 transition-transform duration-200 ${
            active ? 'translate-x-4' : 'translate-x-0'
          }`}
          aria-hidden
        />
      </button>
    </div>
  )
}

function SedeCard({
  sede,
  showRetentionToggle,
  onRetentionUpdated,
}: {
  sede: SedeRow
  showRetentionToggle: boolean
  onRetentionUpdated: () => void
}) {
  const { t } = useLocale()
  const imapConfigured = !!(sede.imap_host && sede.imap_user)

  return (
    <div className="overflow-hidden rounded-lg border border-app-line-28 bg-app-line-10/30 transition-colors hover:border-app-a-45 hover:bg-app-line-10/50">
      <Link href={`/sedi/${sede.id}`} className="group block">
      {/* Accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-cyan-500/40 to-blue-500/25" />

      {/* Sede header */}
      <div className="flex items-center gap-3 border-b border-app-line-15 px-4 py-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/12 ring-1 ring-cyan-500/25">
          <svg className="h-5 w-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-app-fg group-hover:text-cyan-300">{sede.nome}</p>
          <p className="text-xs text-app-fg-muted">
            {sede.operatori_count}{' '}
            {sede.operatori_count === 1 ? t.sediBranches.operatorSingular : t.sediBranches.operatorPlural} · {sede.fornitori_count}{' '}
            {sede.fornitori_count === 1 ? t.sediBranches.supplierSingular : t.sediBranches.supplierPlural}
          </p>
        </div>
        <svg
          className="h-5 w-5 shrink-0 text-app-fg-muted transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* IMAP row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {imapConfigured ? (
          <>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
            <span className="truncate text-xs text-app-fg-muted">{sede.imap_user}</span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {t.common.success}
            </span>
          </>
        ) : (
          <>
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500/70" />
            <span className="truncate text-xs text-app-fg-muted">{t.sedi.notConfigured}</span>
          </>
        )}
      </div>
      </Link>
      {showRetentionToggle ? (
        <FileRetentionListToggle sedeId={sede.id} policy={sede.file_retention_policy} onUpdated={onRetentionUpdated} />
      ) : null}
    </div>
  )
}

function SedeCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-app-line-28 bg-app-line-10/30">
      <div className="h-1 w-full bg-gradient-to-r from-cyan-500/40 to-blue-500/25" />
      <div className="flex items-center gap-3 border-b border-app-line-15 px-4 py-3.5">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-cyan-500/20" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-4 w-36 animate-pulse rounded bg-app-line-20" />
          <div className="h-3 w-24 animate-pulse rounded bg-app-line-15" />
        </div>
      </div>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="h-3 w-3 animate-pulse rounded-full bg-app-line-20" />
        <div className="h-3 w-48 animate-pulse rounded bg-app-line-15" />
      </div>
    </div>
  )
}

export default function SediPage() {
  const { t } = useLocale()
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()

  const masterPlane = effectiveIsMasterAdminPlane(me, activeOperator)
  const isAdminSede = effectiveIsAdminSedeUi(me, activeOperator)
  const canView = masterPlane || isAdminSede

  const [sedi, setSedi] = useState<SedeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSedi = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      /** `GET /api/sedi` conta i profili con service role: il client Supabase rispetta RLS → 0 operatori per staff sede. */
      const res = await fetch('/api/sedi', { credentials: 'include', cache: 'no-store' })
      const j = (await res.json().catch(() => ({}))) as {
        error?: string
        sedi?: Array<{
          id: string
          nome: string
          imap_user?: string | null
          imap_host?: string | null
          country_code?: string | null
          file_retention_policy?: string | null
          fornitori_count?: number
          users_count?: number
        }>
      }
      if (!res.ok) {
        setError(j.error ?? `HTTP ${res.status}`)
        return
      }
      const list = j.sedi ?? []
      setSedi(
        list.map((s) => ({
          id: s.id,
          nome: s.nome,
          imap_user: s.imap_user ?? null,
          imap_host: s.imap_host ?? null,
          country_code: s.country_code ?? null,
          operatori_count: typeof s.users_count === 'number' ? s.users_count : 0,
          fornitori_count: typeof s.fornitori_count === 'number' ? s.fornitori_count : 0,
          file_retention_policy:
            (s as { file_retention_policy?: string | null }).file_retention_policy ?? null,
        })),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore nel caricamento sedi')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canView) void loadSedi()
    else setLoading(false)
  }, [canView, loadSedi])

  const retentionToggleEnabled = FILE_ATTACHMENT_RETENTION_UI_ENABLED && masterPlane

  if (!canView) return null

  return (
    <div className={`${APP_SHELL_SECTION_PAGE_STACK_CLASS} w-full min-w-0 pb-10`}>
      <div className="app-shell-page-padding mx-auto min-w-0 w-full max-w-[var(--app-layout-max-width)]">
        <AppPageHeaderStrip
          accent="teal"
          leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>}
        >
          <AppPageHeaderTitleWithDashboardShortcut className="min-w-0 w-full flex-1 items-center gap-2 sm:gap-3">
            <div className="flex w-full min-w-0 items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>
                  {masterPlane ? t.nav.sediNavGroupMaster : t.nav.sediTitle}
                </h1>
                <p className="text-xs text-app-fg-muted mt-0.5">
                  {sedi.length}
                </p>
              </div>
            </div>
          </AppPageHeaderTitleWithDashboardShortcut>
        </AppPageHeaderStrip>

        <div className="mt-6 space-y-4">
          {loading ? (
            <>
              <SedeCardSkeleton />
              <SedeCardSkeleton />
            </>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4">
              <p className="text-sm font-semibold text-rose-200">{t.common.error}</p>
              <p className="mt-1 text-xs text-rose-300">{error}</p>
              <button
                type="button"
                onClick={() => void loadSedi()}
                className="mt-3 inline-flex touch-manipulation items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/14 px-3 py-1.5 text-xs font-semibold text-rose-100 transition-colors hover:bg-rose-500/22"
              >
                {t.log.retry}
              </button>
            </div>
          ) : sedi.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-app-line-25 bg-app-line-10/20 px-6 py-12 text-center">
              <svg className="h-10 w-10 text-app-fg-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="text-sm text-app-fg-muted">{t.sedi.noSedi}</p>
            </div>
          ) : (
            sedi.map((sede) => (
              <SedeCard
                key={sede.id}
                sede={sede}
                showRetentionToggle={retentionToggleEnabled}
                onRetentionUpdated={() => void loadSedi()}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
