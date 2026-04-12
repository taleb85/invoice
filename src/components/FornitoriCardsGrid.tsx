'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import type { Fornitore } from '@/types'
import OperatorPinStepUpModal from '@/components/OperatorPinStepUpModal'
import { useActiveOperator } from '@/lib/active-operator-context'
import { useMe } from '@/lib/me-context'
import { useT } from '@/lib/use-t'
import { fornitoreDisplayLabel } from '@/lib/fornitore-display'

type Gate = { action: 'detail' | 'edit' | 'delete' | 'unlock'; id: string; nome: string }

export default function FornitoriCardsGrid({ fornitori }: { fornitori: Fornitore[] }) {
  const t = useT()
  const router = useRouter()
  const supabase = createClient()
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const isAdmin = !!(me?.is_admin || me?.role === 'admin')

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
      // Scheda: operatore dal corpo card va diretto; da footer se sbloccato idem.
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
      setGate({ action, id, nome })
    },
    [isAdmin, router, runDelete, unlockedIds],
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
  }, [router, runDelete])

  const detailCls =
    'text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors'
  const editCls =
    'inline-flex items-center gap-1 rounded-lg p-1.5 text-[11px] font-semibold text-slate-400 transition-colors hover:bg-cyan-500/10 hover:text-cyan-300'

  return (
    <>
      <OperatorPinStepUpModal
        open={gate !== null}
        onClose={() => setGate(null)}
        onVerified={onVerified}
        defaultOperatorName={activeOperator?.full_name}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {fornitori.map((f) => {
          const display = fornitoreDisplayLabel(f)
          const hasDisplayAlias = !!(f.display_name?.trim())
          const initials = display
            .split(/\s+/)
            .slice(0, 2)
            .map((w: string) => w[0])
            .filter(Boolean)
            .join('')
            .toUpperCase() || '?'
          return (
            <div
              key={f.id}
              className="app-card group overflow-hidden transition-all hover:border-cyan-500/35"
            >
              <div className="app-card-bar" aria-hidden />
              {isAdmin ? (
                <button
                  type="button"
                  className="block w-full p-5 pb-4 text-left"
                  onClick={() => request('detail', f.id, f.nome)}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-100 truncate text-sm leading-tight group-hover:text-cyan-300 transition-colors">
                        {display}
                      </p>
                      {hasDisplayAlias && (
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{f.nome}</p>
                      )}
                      {f.email && <p className="text-xs text-slate-400 truncate mt-0.5">{f.email}</p>}
                    </div>
                  </div>
                  {f.piva && (
                    <p className="inline-block rounded-lg border border-slate-600/60 bg-slate-800/80 px-2.5 py-1 font-mono text-[10px] text-slate-400">
                      {t.fornitori.pivaLabel} {f.piva}
                    </p>
                  )}
                </button>
              ) : (
                <Link href={`/fornitori/${f.id}`} className="block p-5 pb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-100 truncate text-sm leading-tight group-hover:text-cyan-300 transition-colors">
                        {display}
                      </p>
                      {hasDisplayAlias && (
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{f.nome}</p>
                      )}
                      {f.email && <p className="text-xs text-slate-400 truncate mt-0.5">{f.email}</p>}
                    </div>
                  </div>
                  {f.piva && (
                    <p className="inline-block rounded-lg border border-slate-600/60 bg-slate-800/80 px-2.5 py-1 font-mono text-[10px] text-slate-400">
                      {t.fornitori.pivaLabel} {f.piva}
                    </p>
                  )}
                </Link>
              )}

              <div className="flex items-center justify-center border-t border-slate-700/60 bg-slate-950/40 px-4 py-2.5">
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
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/50 hover:text-red-300"
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
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-red-400/90 transition-colors hover:bg-red-950/40 hover:text-red-300 touch-manipulation"
                    title={t.ui.operatorPinStepUpHint}
                    aria-label={t.ui.operatorPinStepUpTitle}
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
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
