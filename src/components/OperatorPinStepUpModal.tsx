'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useT } from '@/lib/use-t'

const PIN_LENGTH = 4

type Props = {
  open: boolean
  onClose: () => void
  onVerified: () => void
  defaultOperatorName?: string | null
}

export default function OperatorPinStepUpModal({
  open,
  onClose,
  onVerified,
  defaultOperatorName,
}: Props) {
  const t = useT()
  const operatorName = (defaultOperatorName ?? '').trim()
  const canEnterPin = !!operatorName

  const [pin, setPin] = useState<string[]>(() => Array(PIN_LENGTH).fill(''))
  const pinRefs = useRef<(HTMLInputElement | null)[]>([])
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)
  const verifyGenRef = useRef(0)
  const onVerifiedRef = useRef(onVerified)
  const onCloseRef = useRef(onClose)
  onVerifiedRef.current = onVerified
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    setPin(Array(PIN_LENGTH).fill(''))
    setErr('')
    setLoading(false)
    verifyGenRef.current += 1
  }, [open])

  const handlePinChange = useCallback((idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    setPin((prev) => {
      const next = [...prev]
      next[idx] = digit
      return next
    })
    setErr('')
    if (digit && idx < PIN_LENGTH - 1) {
      queueMicrotask(() => pinRefs.current[idx + 1]?.focus())
    }
  }, [])

  const handlePinKeyDown = useCallback((idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !e.currentTarget.value && idx > 0) {
      pinRefs.current[idx - 1]?.focus()
    }
  }, [])

  const handlePinPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH)
    if (!text) return
    const next = Array(PIN_LENGTH).fill('')
    for (let i = 0; i < text.length; i++) next[i] = text[i]!
    setPin(next)
    setErr('')
    const last = Math.min(text.length, PIN_LENGTH) - 1
    pinRefs.current[last]?.focus()
  }, [])

  useEffect(() => {
    if (!open || !canEnterPin) return
    const pinStr = pin.join('')
    if (pinStr.length !== PIN_LENGTH) return
    const myGen = ++verifyGenRef.current
    setLoading(true)
    setErr('')

    void (async () => {
      try {
        const res = await fetch('/api/verify-operator-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: operatorName, pin: pinStr }),
        })
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        if (myGen !== verifyGenRef.current) return
        if (!res.ok) {
          setErr(typeof data.error === 'string' ? data.error : t.ui.pinError)
          setPin(Array(PIN_LENGTH).fill(''))
          pinRefs.current[0]?.focus()
          return
        }
        await createClient().auth.refreshSession().catch(() => {})
        onVerifiedRef.current()
        onCloseRef.current()
      } catch {
        if (myGen === verifyGenRef.current) {
          setErr(t.ui.networkError)
        }
      } finally {
        if (myGen === verifyGenRef.current) setLoading(false)
      }
    })()
  }, [open, canEnterPin, pin, operatorName, t.ui.pinError, t.ui.networkError])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="operator-pin-stepup-title"
      onClick={() => {
        if (!loading) onClose()
      }}
    >
      <div
        className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-900/80 shadow-2xl shadow-black/40 backdrop-blur-xl sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-0.5 w-full bg-gradient-to-r from-blue-500 via-cyan-400 to-cyan-300" />

        <div className="max-h-[min(90vh,32rem)] overflow-y-auto p-6">
          <h2 id="operator-pin-stepup-title" className="text-lg font-bold tracking-tight text-slate-100">
            {t.ui.operatorPinStepUpTitle}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{t.ui.operatorPinStepUpHint}</p>
          {canEnterPin ? (
            <p className="mt-2 text-sm font-medium text-cyan-300/90">
              <span className="text-slate-500">{t.ui.currentlyActive}</span>{' '}
              <span className="uppercase tracking-wide">{operatorName.toUpperCase()}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-amber-400/90">{t.ui.operatorPinStepUpNoActive}</p>
          )}

          <div className="mt-5 space-y-5">
            <div>
              <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-cyan-400/80">
                {t.login.pinLabel}
                <span className="ml-1.5 font-normal normal-case text-slate-500">{t.login.pinDigits}</span>
              </label>
              <div className="flex justify-center gap-3" onPaste={handlePinPaste}>
                {Array.from({ length: PIN_LENGTH }).map((_, idx) => (
                  <input
                    key={idx}
                    ref={(el) => {
                      pinRefs.current[idx] = el
                    }}
                    type="password"
                    inputMode="numeric"
                    maxLength={2}
                    value={pin[idx]}
                    onChange={(e) => handlePinChange(idx, e.target.value)}
                    onKeyDown={(e) => handlePinKeyDown(idx, e)}
                    disabled={loading || !canEnterPin}
                    autoFocus={canEnterPin && idx === 0}
                    className={[
                      'h-14 w-14 rounded-xl border-2 text-center text-xl font-bold transition-all focus:outline-none focus:ring-0',
                      loading || !canEnterPin
                        ? 'border-slate-700 bg-slate-800/50 text-slate-600'
                        : pin[idx]
                          ? 'border-cyan-400/70 bg-cyan-500/15 text-cyan-200 shadow-sm shadow-cyan-500/20'
                          : 'border-slate-600 bg-slate-800/60 text-slate-100 hover:border-cyan-500/50 focus:border-cyan-400 focus:bg-cyan-500/10',
                    ].join(' ')}
                    aria-label={`${t.login.pinLabel} ${idx + 1}/${PIN_LENGTH}`}
                  />
                ))}
              </div>
              <div className="mt-3 flex justify-center gap-2">
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <span
                    key={i}
                    className={[
                      'h-1.5 w-1.5 rounded-full transition-all duration-200',
                      pin[i] ? 'scale-110 bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]' : 'bg-slate-600',
                    ].join(' ')}
                  />
                ))}
              </div>
              {loading ? (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-cyan-400/90">
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8z"
                    />
                  </svg>
                  {t.login.verifying}
                </p>
              ) : null}
            </div>

            {err ? <p className="text-center text-sm text-red-400">{err}</p> : null}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="w-full rounded-xl border border-slate-600/80 bg-slate-800/80 px-3 py-3 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/80 disabled:opacity-50"
              >
                {t.common.cancel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
