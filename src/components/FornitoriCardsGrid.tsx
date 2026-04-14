'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Fornitore } from '@/types'
import OperatorPinStepUpModal from '@/components/OperatorPinStepUpModal'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsFornitoreGridAdmin } from '@/lib/effective-operator-ui'
import { useMe } from '@/lib/me-context'
import { useT } from '@/lib/use-t'
import { fornitoreDisplayLabel } from '@/lib/fornitore-display'
import { cacheFornitoriList, readCachedFornitoriList } from '@/lib/app-data-cache'
import { useNetworkStatusOptional } from '@/lib/network-context'
import { SUMMARY_HIGHLIGHT_ACCENTS } from '@/lib/summary-highlight-accent'

/** Allineato al KPI «Fornitori» (`operatorKpiVisual` sky) e a `AppSummaryHighlightCard accent="sky"`. */
const fornitoriCardTheme = SUMMARY_HIGHLIGHT_ACCENTS.sky

type Gate = { action: 'detail' | 'edit' | 'delete' | 'unlock'; id: string; nome: string }

export default function FornitoriCardsGrid({
  fornitori,
  sedeScope,
  emptyState,
  addFirstLabel,
  /** Lista completa per cache offline; se assente si usa `fornitori`. */
  cacheSourceFornitori,
  /** Se false, stato vuoto senza link «Aggiungi il primo». */
  showAddWhenEmpty = true,
}: {
  fornitori: Fornitore[]
  sedeScope: string
  emptyState: string
  addFirstLabel: string
  cacheSourceFornitori?: Fornitore[]
  showAddWhenEmpty?: boolean
}) {
  const t = useT()
  const router = useRouter()
  const supabase = createClient()
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const isAdmin = effectiveIsFornitoreGridAdmin(me, activeOperator)
  const net = useNetworkStatusOptional()

  const [rows, setRows] = useState<Fornitore[]>(fornitori)
  const [listSource, setListSource] = useState<'server' | 'cache'>('server')
  const cacheSeed = cacheSourceFornitori ?? fornitori
  const [cacheReady, setCacheReady] = useState(
    () => fornitori.length > 0 || (cacheSourceFornitori?.length ?? 0) > 0,
  )

  useEffect(() => {
    void cacheFornitoriList(sedeScope, cacheSeed)
  }, [cacheSeed, sedeScope])

  useEffect(() => {
    if (cacheSeed.length > 0) {
      setRows(fornitori)
      setListSource('server')
      setCacheReady(true)
      return
    }
    if (typeof navigator === 'undefined') {
      setRows(fornitori)
      setCacheReady(true)
      return
    }
    if (navigator.onLine) {
      setRows(fornitori)
      setListSource('server')
      setCacheReady(true)
      return
    }
    void readCachedFornitoriList(sedeScope).then((cached) => {
      if (cached?.length) {
        setRows(cached as Fornitore[])
        setListSource('cache')
      } else {
        setRows(fornitori)
        setListSource('server')
      }
      setCacheReady(true)
    })
  }, [fornitori, cacheSeed, sedeScope])

  useEffect(() => {
    if (net?.online && listSource === 'cache') {
      router.refresh()
    }
  }, [net?.online, listSource, router])

  const [gate, setGate] = useState<Gate | null>(null)
  const gateRef = useRef<Gate | null>(null)
  gateRef.current = gate

  /** Per card: dopo PIN mostra etichette Dettaglio / Modifica / Elimina. */
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(() => new Set())

  const deleteConfirmFor = useCallback(
    (nome: string) =>
      t.fornitori.deleteConfirm
        .replace('questo fornitore', `"${nome}"`)
        .replace('Delete this supplier', `"${nome}"`),
    [t.fornitori.deleteConfirm],
  )

  const runDelete = useCallback(
    async (id: string, nome: string) => {
      const msg = deleteConfirmFor(nome)
      if (!confirm(msg)) return
      const { error } = await supabase.from('fornitori').delete().eq('id', id)
      if (error) {
        alert(`${t.appStrings.deleteFailed} ${error.message}`)
        return
      }
      router.refresh()
    },
    [deleteConfirmFor, router, supabase, t.appStrings.deleteFailed],
  )

  const request = useCallback(
    (action: Gate['action'], id: string, nome: string) => {
      if (action === 'unlock') {
        setGate({ action: 'unlock', id, nome })
        return
      }
      // Scheda: corpo card → dettaglio senza PIN (anche admin). PIN solo dal footer (unlock).
      if (action === 'detail' && !isAdmin) {
        window.location.assign(`/fornitori/${id}`)
        return
      }
      if (unlockedIds.has(id)) {
        if (action === 'detail') window.location.assign(`/fornitori/${id}`)
        else if (action === 'edit') window.location.assign(`/fornitori/${id}/edit`)
        else if (action === 'delete') void runDelete(id, nome)
        return
      }
      if (action === 'detail' && isAdmin) {
        window.location.assign(`/fornitori/${id}`)
        return
      }
      setGate({ action, id, nome })
    },
    [isAdmin, runDelete, unlockedIds],
  )

  const onVerified = useCallback(() => {
    const g = gateRef.current
    if (!g) return
    setGate(null)
    if (g.action === 'unlock') {
      setUnlockedIds((prev) => new Set(prev).add(g.id))
      return
    }
    if (g.action === 'detail') window.location.assign(`/fornitori/${g.id}`)
    else if (g.action === 'edit') window.location.assign(`/fornitori/${g.id}/edit`)
    else if (g.action === 'delete') void runDelete(g.id, g.nome)
  }, [runDelete])

  const detailCls =
    'text-[10px] font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-0.5 transition-colors sm:text-[11px] sm:gap-1'
  const editCls =
    'inline-flex items-center gap-0.5 rounded-lg p-1 text-[10px] font-semibold text-slate-200 transition-colors hover:bg-sky-500/10 hover:text-sky-300 sm:gap-1 sm:p-1.5 sm:text-[11px]'

  if (!cacheReady) {
    return (
      <div className={`app-card overflow-hidden ${fornitoriCardTheme.border}`}>
        <div className={`app-card-bar ${fornitoriCardTheme.bar}`} aria-hidden />
        <div className="h-32 animate-pulse bg-slate-700/40" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className={`app-card overflow-hidden ${fornitoriCardTheme.border}`}>
        <div className={`app-card-bar ${fornitoriCardTheme.bar}`} aria-hidden />
        <div className="px-4 py-12 text-center sm:px-6 sm:py-16">
          <svg className="mx-auto mb-4 h-14 w-14 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="text-sm font-medium text-slate-200">{emptyState}</p>
          {showAddWhenEmpty ? (
            <Link
              href="/fornitori/new"
              className="mt-4 inline-block text-sm font-medium text-sky-400 hover:text-sky-300 hover:underline"
            >
              {addFirstLabel}
            </Link>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <>
      <OperatorPinStepUpModal
        open={gate !== null}
        onClose={() => setGate(null)}
        onVerified={onVerified}
        defaultOperatorName={activeOperator?.full_name}
      />

      {listSource === 'cache' && (
        <div className="mb-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-100/90 sm:mb-4 sm:px-3 sm:py-2 sm:text-xs">
          {t.fornitori.rekkiCachedListBanner}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rows.map((f) => {
          const display = fornitoreDisplayLabel(f)
          const hasDisplayAlias = !!(f.display_name?.trim())
          const rekkiMapped = !!(f.rekki_supplier_id?.trim())
          const initials = display
            .split(/\s+/)
            .slice(0, 2)
            .map((w: string) => w[0])
            .filter(Boolean)
            .join('')
            .toUpperCase() || '?'

          const bodyClasses =
            'flex min-h-0 w-full flex-1 flex-col gap-0 p-2.5 pb-2 items-stretch sm:gap-4 sm:p-5 sm:pb-4'
          const avatarShell =
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 via-sky-500 to-blue-600 text-xs font-bold text-white shadow-md shadow-sky-950/40 ring-2 ring-slate-600/50 ring-offset-1 ring-offset-slate-700/95 sm:h-14 sm:w-14 sm:text-base sm:ring-offset-2'
          const pivaPillSm = f.piva ? (
            <p className="hidden rounded-full border border-slate-500/45 bg-slate-800/90 px-3 py-1 font-mono text-[10px] text-slate-200 sm:inline-block">
              {t.fornitori.pivaLabel} {f.piva}
            </p>
          ) : null
          const headBlock = (
            <>
              <div className={`${avatarShell} self-start`}>{initials}</div>
              <div className="min-w-0 flex-1 text-left">
                <div className="flex min-w-0 flex-row flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <p className="min-w-0 max-w-full truncate text-sm font-bold leading-tight text-slate-100 transition-colors group-hover:text-sky-300 sm:flex-1 sm:text-base">
                    {display}
                  </p>
                  {rekkiMapped ? (
                    <span className="shrink-0 rounded-full border border-violet-500/40 bg-violet-500/15 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-violet-200 sm:px-2 sm:py-0.5 sm:text-[9px]">
                      {t.fornitori.rekkiConnectedBadge}
                    </span>
                  ) : null}
                </div>
                {hasDisplayAlias ? (
                  <p className="mt-0.5 truncate text-[10px] text-slate-500 sm:mt-1 sm:text-[11px]">{f.nome}</p>
                ) : null}
                {f.email ? (
                  <p className="mt-0.5 truncate text-[11px] text-slate-300 sm:mt-1 sm:text-xs">{f.email}</p>
                ) : null}
              </div>
            </>
          )
          const pivaBlock = (
            <div className="mt-auto hidden min-h-0 items-end justify-start sm:flex sm:min-h-[2.5rem]">
              {pivaPillSm}
            </div>
          )

          return (
            <div
              key={f.id}
              className={`app-card group relative flex h-full flex-col overflow-hidden rounded-2xl transition-all sm:rounded-3xl ${fornitoriCardTheme.border} hover:border-sky-400/45 hover:shadow-lg hover:shadow-sky-500/12`}
            >
              <div
                className={`app-card-bar h-0.5 shrink-0 rounded-t-2xl sm:h-1 sm:rounded-t-3xl ${fornitoriCardTheme.bar}`}
                aria-hidden
              />
              {isAdmin ? (
                <button type="button" className={bodyClasses} onClick={() => request('detail', f.id, f.nome)}>
                  <div className="flex min-w-0 flex-1 flex-row items-start gap-2 sm:gap-4">
                    {headBlock}
                  </div>
                  {pivaBlock}
                </button>
              ) : (
                <Link href={`/fornitori/${f.id}`} className={bodyClasses}>
                  <div className="flex min-w-0 flex-1 flex-row items-start gap-2 sm:gap-4">
                    {headBlock}
                  </div>
                  {pivaBlock}
                </Link>
              )}

              <div className="mt-auto flex shrink-0 items-center justify-center rounded-b-2xl border-t border-slate-600/35 bg-slate-800/35 px-2 py-1.5 backdrop-blur-sm sm:rounded-b-3xl sm:px-4 sm:py-2.5">
                {unlockedIds.has(f.id) ? (
                  <div className="flex w-full items-center justify-between gap-2">
                    <button type="button" className={detailCls} onClick={() => request('detail', f.id, f.nome)}>
                      {t.common.detail}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
                      <button
                        type="button"
                        className={editCls}
                        title={t.common.edit}
                        onClick={() => request('edit', f.id, f.nome)}
                      >
                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        <span>{t.common.edit}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => request('delete', f.id, f.nome)}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-950/50 hover:text-red-300 sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs"
                      >
                        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                        {t.common.delete}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => request('unlock', f.id, f.nome)}
                    className="flex min-h-[44px] w-full max-w-full items-center justify-center gap-2 rounded-lg px-2 text-amber-400/95 transition-colors hover:bg-amber-950/25 hover:text-amber-300 touch-manipulation"
                    title={t.ui.operatorPinStepUpHint}
                    aria-label={`${t.ui.operatorPinStepUpTitle} — ${t.fornitori.cardFooterUnlockPin}`}
                  >
                    <svg
                      className="h-5 w-5 shrink-0 sm:h-6 sm:w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                    <span className="min-w-0 truncate text-left text-[11px] font-semibold leading-tight text-slate-200 sm:text-xs">
                      {t.fornitori.cardFooterUnlockPin}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
