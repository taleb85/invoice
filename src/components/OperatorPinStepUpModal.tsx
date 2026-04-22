'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useT } from '@/lib/use-t'
import { useActiveOperator } from '@/lib/active-operator-context'

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
  const { openSwitchModal } = useActiveOperator()
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
      className="fixed inset-0 z-[200] flex items-center justify-center app-workspace-scrim p-4 pt-4 ring-1 ring-inset ring-app-line-10 max-md:pb-[max(1.25rem,env(safe-area-inset-bottom))] md:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="operator-pin-stepup-title"
      onClick={() => {
        if (!loading) onClose()
      }}
    >
      <div
        className="app-card pointer-events-auto relative flex w-full max-w-sm flex-col overflow-hidden p-0 sm:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="app-card-bar shrink-0" aria-hidden />

        <div className="max-h-[min(90vh,32rem)] overflow-y-auto overscroll-contain app-workspace-inset-bg-soft p-6">
          <h2 id="operator-pin-stepup-title" className="text-lg font-bold tracking-tight text-app-fg">
            {t.ui.operatorPinStepUpTitle}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">{t.ui.operatorPinStepUpHint}</p>
          {canEnterPin ? (
            <p className="mt-2 text-sm font-medium text-app-fg-muted">
              <span className="text-app-fg-muted">{t.ui.currentlyActive}</span>{' '}
              <span className="uppercase tracking-wide text-app-fg">{operatorName.toUpperCase()}</span>
            </p>
          ) : (
            <>
              <p className="mt-2 rounded-lg border border-[rgba(34,211,238,0.15)] bg-amber-950/25 px-3 py-2 text-sm text-amber-100/95">
                {t.ui.operatorPinStepUpNoActive}
              </p>
              <button
                type="button"
                onClick={() => openSwitchModal()}
                disabled={loading}
                className="mt-4 w-full rounded-xl bg-gradient-to-r from-app-cyan-500 to-app-cyan-400 px-4 py-3 text-sm font-semibold text-cyan-950 shadow-[0_0_20px_rgba(34,211,238,0.35)] transition-opacity hover:opacity-95 disabled:opacity-50"
              >
                {t.ui.operatorPinStepUpChooseOperator}
              </button>
            </>
          )}

          <div className="mt-5 space-y-5">
            <div>
              <label className="mb-3 block text-xs font-semibold uppercase tracking-wide text-app-fg-muted">
                {t.login.pinLabel}
                <span className="ml-1.5 font-normal normal-case text-app-fg-muted">{t.login.pinDigits}</span>
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
                      'h-14 w-14 rounded-xl border-2 text-center text-xl font-bold transition-all focus:outline-none focus:ring-2 focus:ring-app-a-35',
                      loading || !canEnterPin
                        ? 'border-app-line-10 app-workspace-inset-bg text-app-fg-muted'
                        : pin[idx]
                          ? 'border-app-a-70 bg-app-line-15 text-app-fg-muted shadow-[0_0_16px_-4px_rgba(34,211,238,0.35)]'
                          : 'border-app-line-35 app-workspace-inset-bg text-app-fg hover:border-app-a-55 focus:border-app-a-55 focus:bg-app-line-10',
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
                      pin[i] ? 'scale-110 bg-app-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.6)]' : 'bg-cyan-800/70',
                    ].join(' ')}
                  />
                ))}
              </div>
              {loading ? (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-app-fg-muted">
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
                className="w-full rounded-xl border border-app-line-35 app-workspace-inset-bg-soft px-3 py-3 text-sm font-medium text-app-fg-muted transition-colors hover:border-app-a-45 hover:bg-app-line-10 hover:text-app-fg disabled:opacity-50"
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
