'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useActiveOperator, ActiveOperator } from '@/lib/active-operator-context'
import { useMe } from '@/lib/me-context'
import { useT } from '@/lib/use-t'
import { createClient } from '@/utils/supabase/client'
import { PinNumpad } from '@/components/PinNumpad'

const PIN_LENGTH = 4

interface Operator {
  id:        string
  full_name: string
  role:      'operatore' | 'admin_sede'
}

type Step = 'select' | 'pin'

export default function OperatorSwitchModal() {
  const { me } = useMe()
  const t = useT()
  const {
    activeOperator, setActiveOperator,
    showSwitchModal, closeSwitchModal,
  } = useActiveOperator()

  const [step, setStep]             = useState<Step>('select')
  const [operators, setOperators]   = useState<Operator[]>([])
  const [selected, setSelected]     = useState<Operator | null>(null)
  const [pin, setPin]               = useState<string[]>(Array(PIN_LENGTH).fill(''))
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [loadingOps, setLoadingOps] = useState(false)
  const [noSedeContext, setNoSedeContext] = useState(false)

  const firstBtnRef = useRef<HTMLButtonElement | null>(null)

  /**
   * Sedi da interrogare per la lista operatori.
   * Admin: sempre tutte le sedi in anagrafica — il `sede_id` sul profilo admin può
   * essere una sede “di default” diversa da quella dove stanno gli operatori
   * (es. Mediterraneo), e prima si interrogava solo quella sbagliando lista vuota.
   * Non-admin: sede dell’operatore attivo, altrimenti quella del profilo.
   */
  const resolveOperatorSedeIds = useCallback((): string[] => {
    if (me?.is_admin) {
      if (me.all_sedi?.length) return me.all_sedi.map((s) => s.id)
      if (me.sede_id) return [me.sede_id]
      return []
    }
    if (activeOperator?.sede_id) return [activeOperator.sede_id]
    if (me?.sede_id) return [me.sede_id]
    return []
  }, [me?.is_admin, me?.all_sedi, me?.sede_id, activeOperator?.sede_id])

  /* ── Fetch operators when modal opens ── */
  useEffect(() => {
    if (!showSwitchModal) return

    setStep('select')
    setPin(Array(PIN_LENGTH).fill(''))
    setError('')
    setSelected(null)

    const sedeIds = resolveOperatorSedeIds()
    if (sedeIds.length === 0) {
      setNoSedeContext(true)
      setOperators([])
      setLoadingOps(false)
      return
    }
    setNoSedeContext(false)
    setLoadingOps(true)

    Promise.all(
      sedeIds.map((id) =>
        fetch(`/api/operators-for-sede?sedeId=${encodeURIComponent(id)}`).then((r) => r.json()),
      ),
    )
      .then((payloads) => {
        const seen = new Set<string>()
        const merged: Operator[] = []
        for (const d of payloads) {
          for (const o of d.operators ?? []) {
            if (!o?.id || seen.has(o.id)) continue
            seen.add(o.id)
            merged.push({
              id:        o.id,
              full_name: o.full_name ?? '',
              role:      o.role === 'admin_sede' ? 'admin_sede' : 'operatore',
            })
          }
        }
        merged.sort((a, b) =>
          a.full_name.localeCompare(b.full_name, undefined, { sensitivity: 'base' }),
        )
        setOperators(merged)
        if (activeOperator) {
          const cur = merged.find((o) => o.id === activeOperator.id)
          if (cur) setSelected(cur)
        }
      })
      .finally(() => setLoadingOps(false))
  }, [
    showSwitchModal,
    resolveOperatorSedeIds,
    activeOperator,
  ])

  /* ── Reset on close ── */
  const handleClose = useCallback(() => {
    closeSwitchModal()
    setTimeout(() => {
      setStep('select')
      setPin(Array(PIN_LENGTH).fill(''))
      setError('')
    }, 300)
  }, [closeSwitchModal])

  /* ── PIN keypad ── */
  const currentPin = pin.join('')

  const pressDigit = useCallback((d: string) => {
    setError('')
    setPin(prev => {
      const filled = prev.filter(x => x !== '').length
      if (filled >= PIN_LENGTH) return prev
      const next = [...prev]
      next[filled] = d
      return next
    })
  }, [])

  const backspace = useCallback(() => {
    setPin(prev => {
      const filled = prev.filter(x => x !== '').length
      if (filled === 0) return prev
      const next = [...prev]
      next[filled - 1] = ''
      return next
    })
  }, [])

  const clearPin = useCallback(() => {
    setPin(Array(PIN_LENGTH).fill(''))
    setError('')
  }, [])

  /* ── Verify PIN auto-submit when complete ── */
  useEffect(() => {
    if (currentPin.length !== PIN_LENGTH || loading) return
    verifyPin()
  }, [currentPin]) // eslint-disable-line react-hooks/exhaustive-deps

  const verifyPin = useCallback(async () => {
    if (!selected) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/verify-operator-pin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: selected.full_name, pin: currentPin }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? t.ui.pinError)
        clearPin()
        setLoading(false)
        return
      }
      await createClient().auth.refreshSession().catch(() => {})
      const op: ActiveOperator = {
        id:        data.id,
        full_name: data.full_name,
        sede_id:   data.sede_id,
        sede_nome: data.sede_nome,
        role:      data.role === 'admin_sede' ? 'admin_sede' : 'operatore',
      }
      setActiveOperator(op, me?.user?.id ?? null)
      if (me?.is_admin && typeof data.sede_id === 'string' && data.sede_id) {
        document.cookie = `admin-sede-id=${encodeURIComponent(data.sede_id)}; path=/; SameSite=Strict`
        const ar = data.role === 'admin_sede' ? 'admin_sede' : 'operatore'
        document.cookie = `fluxo-acting-role=${encodeURIComponent(ar)}; path=/; SameSite=Strict`
      }
      try {
        window.dispatchEvent(
          new CustomEvent('fluxo:active-operator-changed', {
            detail: { operator: op },
          }),
        )
      } catch {
        /* ignore */
      }
      /** Hard refresh: stato RSC/cache browser allineato al nuovo operatore. */
      window.location.reload()
      return
    } catch {
      setError(t.ui.networkError)
      clearPin()
    }
    setLoading(false)
  }, [selected, currentPin, setActiveOperator, clearPin, me?.is_admin, me?.user?.id, t.ui.networkError, t.ui.pinError])

  /* ── Keyboard support ── */
  useEffect(() => {
    if (!showSwitchModal || step !== 'pin') return
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') pressDigit(e.key)
      else if (e.key === 'Backspace')    backspace()
      else if (e.key === 'Escape')       handleClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showSwitchModal, step, pressDigit, backspace, handleClose])

  if (!showSwitchModal) return null

  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="operator-switch-modal-title"
      className="fixed inset-0 z-[220] flex items-center justify-center app-workspace-scrim px-4 pt-4 ring-1 ring-inset ring-app-line-10 max-md:pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div
        className="app-card pointer-events-auto flex max-h-[min(90dvh,36rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 p-0 text-app-fg shadow-[0_4px_40px_rgb(0_0_0/_0.42),0_0_0_1px_rgb(255_255_255/_0.06)]"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-app-line-15 app-workspace-inset-bg-soft px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-app-line-35 bg-app-line-15 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <svg className="h-5 w-5 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            <div className="min-w-0">
              <p id="operator-switch-modal-title" className="text-base font-semibold tracking-tight text-app-fg">
                {t.ui.changeOperator}
              </p>
              {activeOperator && (
                <p className="text-[11px] text-app-fg-muted">
                  {t.ui.currentlyActive}{' '}
                  <span className="font-medium text-app-fg-muted tracking-wide">
                    {activeOperator.full_name.toUpperCase()}
                  </span>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-app-fg-muted transition-colors hover:bg-app-line-15 hover:text-app-fg touch-manipulation"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain app-workspace-inset-bg p-4 sm:p-5">

          {/* ─ Step: select operator ─ */}
          {step === 'select' && (
            <div className="space-y-4">
              {loadingOps ? (
                <div className="py-8 flex justify-center">
                  <svg className="w-6 h-6 text-app-cyan-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                </div>
              ) : noSedeContext ? (
                <p className="px-1 py-6 text-center text-sm text-app-fg-muted">
                  {t.ui.noSedeForOperators}
                </p>
              ) : operators.length === 0 ? (
                <p className="py-6 text-center text-sm text-app-fg-muted">
                  {t.ui.noOperatorsFound}
                </p>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide text-app-fg-muted">
                    {t.ui.selectOperator}
                  </p>
                  <div className="space-y-2">
                    {operators.map(op => (
                      <button
                        key={op.id}
                        type="button"
                        ref={op.id === operators[0].id ? firstBtnRef : undefined}
                        onClick={() => { setSelected(op); setStep('pin'); setPin(Array(PIN_LENGTH).fill('')); setError('') }}
                        className={[
                          'flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all touch-manipulation active:scale-[0.99]',
                          selected?.id === op.id
                            ? 'border-sky-400/45 text-app-fg shadow-[0_0_24px_-10px_rgba(56,189,248,0.35)] ring-1 ring-sky-400/25 app-workspace-inset-bg'
                            : 'border-app-line-25 text-app-fg-muted ring-1 ring-app-line-5 hover:border-sky-400/35 app-workspace-inset-bg-soft',
                        ].join(' ')}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-app-line-35 bg-app-line-15 text-sm font-bold text-app-fg-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                          {(op.full_name.trim().toUpperCase() || '?').charAt(0)}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-sm font-semibold tracking-wide">
                            {op.full_name}
                          </span>
                        </div>
                        {activeOperator?.id === op.id && (
                          <span className="ml-auto shrink-0 text-[10px] bg-app-line-20 text-app-cyan-500 px-2 py-0.5 rounded-full font-semibold">
                            {t.ui.activeOperator}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ─ Step: PIN entry ─ */}
          {step === 'pin' && (
            <div className="space-y-5">
              {/* Who we're logging in as */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setStep('select'); clearPin() }}
                  className="rounded-lg p-1.5 text-app-fg-muted transition-colors hover:bg-app-line-12 hover:text-app-fg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-app-line-35 bg-app-line-15 text-sm font-bold text-app-fg-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  {(selected?.full_name.trim().toUpperCase() || '?').charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold tracking-wide text-app-fg">
                    {selected?.full_name}
                  </p>
                  <p className="text-[11px] text-app-fg-muted">{t.login.pinLabel}</p>
                </div>
              </div>

              {/* PIN dots display */}
              <div className="flex justify-center gap-3">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <div
                    key={i}
                    className={[
                      'w-4 h-4 rounded-full transition-all duration-150',
                      pin[i]
                        ? 'scale-110 bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.55)]'
                        : 'border border-app-line-35 app-workspace-inset-bg',
                    ].join(' ')}
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-sky-400/20 bg-red-950/40 px-3 py-2 ring-1 ring-red-500/15">
                  <svg className="w-3.5 h-3.5 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span className="text-xs text-red-200">{error}</span>
                </div>
              )}

              {/* Keypad */}
              {loading ? (
                <div className="py-6 flex justify-center">
                  <svg className="w-8 h-8 text-app-cyan-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                </div>
              ) : (
                <PinNumpad
                  onDigit={pressDigit}
                  onBackspace={backspace}
                  onClear={clearPin}
                  disabled={loading}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
