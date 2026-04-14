'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useActiveOperator, ActiveOperator } from '@/lib/active-operator-context'
import { useMe } from '@/lib/me-context'
import { useT } from '@/lib/use-t'
import { createClient } from '@/utils/supabase/client'

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
    inactivityTimeout, setInactivityTimeout,
  } = useActiveOperator()

  const [step, setStep]             = useState<Step>('select')
  const [operators, setOperators]   = useState<Operator[]>([])
  const [selected, setSelected]     = useState<Operator | null>(null)
  const [pin, setPin]               = useState<string[]>(Array(PIN_LENGTH).fill(''))
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [loadingOps, setLoadingOps] = useState(false)
  const [noSedeContext, setNoSedeContext] = useState(false)

  const pinRefs = useRef<(HTMLButtonElement | null)[]>([])
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

  const KEYS = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['C','0','⌫'],
  ]

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 px-4 pt-4 backdrop-blur-sm max-md:pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
    >
      <div className="flex max-h-[min(90dvh,36rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-4 py-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15">
              <svg className="h-5 w-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-white">{t.ui.changeOperator}</p>
              {activeOperator && (
                <p className="text-[11px] text-slate-500">
                  {t.ui.currentlyActive}{' '}
                  <span className="text-slate-400 uppercase tracking-wide">
                    {activeOperator.full_name.toUpperCase()}
                  </span>
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200 touch-manipulation"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">

          {/* ─ Step: select operator ─ */}
          {step === 'select' && (
            <div className="space-y-4">
              {loadingOps ? (
                <div className="py-8 flex justify-center">
                  <svg className="w-6 h-6 text-cyan-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                </div>
              ) : noSedeContext ? (
                <p className="text-center text-slate-500 text-sm py-6 px-1">
                  {t.ui.noSedeForOperators}
                </p>
              ) : operators.length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-6">
                  {t.ui.noOperatorsFound}
                </p>
              ) : (
                <>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
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
                          'flex min-h-[56px] w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all touch-manipulation active:scale-[0.99]',
                          selected?.id === op.id
                            ? 'border-cyan-500/40 bg-cyan-500/10 text-white'
                            : 'border-slate-700/60 bg-slate-800/40 text-slate-300 hover:border-slate-600 hover:bg-slate-800/70',
                        ].join(' ')}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-bold text-slate-300">
                          {(op.full_name.trim().toUpperCase() || '?').charAt(0)}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-sm font-semibold uppercase tracking-wide">
                            {op.full_name.toUpperCase()}
                          </span>
                          {op.role === 'admin_sede' && (
                            <span className="text-[10px] font-medium text-violet-300/90">
                              {t.sedi.adminSedeRole}
                            </span>
                          )}
                        </div>
                        {activeOperator?.id === op.id && (
                          <span className="ml-auto shrink-0 text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-semibold">
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
                  onClick={() => { setStep('select'); clearPin() }}
                  className="p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <div className="w-9 h-9 rounded-full bg-cyan-500/15 flex items-center justify-center text-sm font-bold text-cyan-300">
                  {(selected?.full_name.trim().toUpperCase() || '?').charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white uppercase tracking-wide">
                    {selected?.full_name.toUpperCase()}
                  </p>
                  <p className="text-[11px] text-slate-500">{t.login.pinLabel}</p>
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
                        ? 'bg-cyan-400 scale-110 shadow-[0_0_8px_rgba(34,211,238,0.6)]'
                        : 'bg-slate-700 border border-slate-600',
                    ].join(' ')}
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <svg className="w-3.5 h-3.5 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <span className="text-xs text-red-300">{error}</span>
                </div>
              )}

              {/* Keypad — tablet optimized */}
              {loading ? (
                <div className="py-6 flex justify-center">
                  <svg className="w-8 h-8 text-cyan-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  {KEYS.flat().map((key, i) => {
                    const isDigit   = key >= '0' && key <= '9'
                    const isDelete  = key === '⌫'
                    const isClear   = key === 'C'

                    return (
                      <button
                        key={i}
                        ref={el => { pinRefs.current[i] = el }}
                        onClick={() => {
                          if (isDigit)  pressDigit(key)
                          if (isDelete) backspace()
                          if (isClear)  clearPin()
                        }}
                        className={[
                          'min-h-[52px] rounded-2xl text-xl font-bold transition-all select-none touch-manipulation active:scale-95 sm:h-16 sm:text-lg',
                          isDigit
                            ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/60 shadow-sm'
                            : isClear
                              ? 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border border-slate-700/40'
                              : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 border border-slate-700/40',
                        ].join(' ')}
                      >
                        {key}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — inactivity setting */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <label className="flex min-h-[44px] items-center gap-2 text-xs text-slate-500 sm:min-h-0">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              <span>{t.ui.operatorAutoLockLabel}</span>
            </label>
            <select
              value={inactivityTimeout}
              onChange={(e) => setInactivityTimeout(Number(e.target.value))}
              className="min-h-[48px] w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 touch-manipulation sm:min-h-[44px] sm:w-auto sm:min-w-[8.5rem]"
            >
              <option value={0}>{t.ui.operatorAutoLockNever}</option>
              <option value={5}>{t.ui.operatorAutoLockMinutes.replace('{n}', '5')}</option>
              <option value={10}>{t.ui.operatorAutoLockMinutes.replace('{n}', '10')}</option>
              <option value={15}>{t.ui.operatorAutoLockMinutes.replace('{n}', '15')}</option>
              <option value={30}>{t.ui.operatorAutoLockMinutes.replace('{n}', '30')}</option>
            </select>
          </div>
      </div>
    </div>
  )
}
