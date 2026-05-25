'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/lib/locale-context'
import { useToast } from '@/lib/toast-context'
import type { Translations } from '@/lib/translations'

type AiSuggestion = {
  type: 'info' | 'anomaly' | 'convert-to-fattura' | 'not-invoice' | 'assign-supplier' | 'add-potential-supplier'
  label: string
  description: string
  supplier_name?: string
  contact_email?: string
  contact_phone?: string
  product_types?: string[]
  document_type_label?: string
}

type AiAnalysisResult = {
  analysis: string
  suggestions: AiSuggestion[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: 'bolla' | 'fattura'
  entityId: string
  /** Solo per bolla: fornitore_id opzionale per navigazione a nuova fattura */
  fornitoreId?: string | null
}

const severityConfig: Record<
  AiSuggestion['type'],
  { border: string; icon: string; btnVariant: string }
> = {
  info: { border: 'border-sky-500/30', icon: 'ℹ️', btnVariant: 'bg-sky-500/10 text-sky-300 hover:bg-sky-500/20' },
  anomaly: { border: 'border-amber-500/30', icon: '⚠️', btnVariant: 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20' },
  'convert-to-fattura': { border: 'border-emerald-500/30', icon: '📄', btnVariant: 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' },
  'not-invoice': { border: 'border-red-500/30', icon: '🚫', btnVariant: 'bg-red-500/10 text-red-300 hover:bg-red-500/20' },
  'assign-supplier': { border: 'border-violet-500/30', icon: '🏷️', btnVariant: 'bg-violet-500/10 text-violet-300 hover:bg-violet-500/20' },
  'add-potential-supplier': { border: 'border-emerald-500/30', icon: '➕', btnVariant: 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20' },
}

function buildLoadingSteps(t: Translations): Array<{ step: string; message: string }> {
  return [
    { step: 'fetching', message: t.aiAnalysisModal.loadingFetching },
    { step: 'downloading', message: t.aiAnalysisModal.loadingDownloading },
    { step: 'analyzing', message: t.aiAnalysisModal.loadingAnalyzing },
    { step: 'parsing', message: t.aiAnalysisModal.loadingParsing },
  ]
}

export function AiAnalysisModal({
  open,
  onOpenChange,
  entityType,
  entityId,
  fornitoreId,
}: Props) {
  const router = useRouter()
  const titleId = useId()
  const { locale, t } = useLocale()
  const { showToast } = useToast()
  const LOADING_STEPS = useMemo(() => buildLoadingSteps(t), [t])
  const [mounted, setMounted] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<AiAnalysisResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const [applyingAnomaly, setApplyingAnomaly] = useState(false)
  const [addingPotentialSupplier, setAddingPotentialSupplier] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const close = useCallback(() => onOpenChange(false), [onOpenChange])

  const doAnalyze = useCallback(async () => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setStatus('loading')
    setResult(null)
    setErrorMsg('')
    setActiveStepIndex(0)

    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityType, entityId, locale }),
        signal: ac.signal,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? t.common.httpError.replace('{code}', String(res.status)))
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          if (ac.signal.aborted) return

          const event = JSON.parse(line)

          if (event.type === 'progress') {
            const idx = LOADING_STEPS.findIndex((s) => s.step === event.step)
            if (idx !== -1) {
              setActiveStepIndex(idx + 1)
            }
          } else if (event.type === 'result') {
            setResult(event.data)
            setStatus('done')
            setActiveStepIndex(LOADING_STEPS.length)
          } else if (event.type === 'error') {
            throw new Error(event.error ?? event.message ?? t.common.unknownError)
          }
        }
      }
    } catch (err) {
      if (ac.signal.aborted) return
      setErrorMsg(err instanceof Error ? err.message : t.common.unknownError)
      setStatus('error')
    }
  }, [entityType, entityId, locale, LOADING_STEPS, t])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (status !== 'loading') return
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => Math.min(prev + 1, LOADING_STEPS.length - 1))
    }, 8000)
    return () => clearInterval(interval)
  }, [status, LOADING_STEPS])

  useEffect(() => {
    if (!open) {
      setStatus('idle')
      setResult(null)
      setErrorMsg('')
      setActiveStepIndex(0)
      return
    }

    doAnalyze()

    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
      abortRef.current?.abort()
    }
  }, [open, doAnalyze, close])

  const handleSuggestionAction = useCallback(
    async (s: AiSuggestion) => {
      if (s.type === 'anomaly') {
        setApplyingAnomaly(true)
        try {
          const res = await fetch('/api/ai-analysis/anomaly/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entityType, entityId, label: s.label, description: s.description }),
          })
          const data = await res.json()
          if (!res.ok) {
            showToast(data.error ?? t.aiAnalysisModal.correctionError, 'error')
          } else if (data.applied && data.applied.length > 0) {
            showToast(data.message, 'success')
            doAnalyze()
          } else {
            showToast(data.message, 'info')
          }
        } catch {
          showToast(t.common.networkError, 'error')
        } finally {
          setApplyingAnomaly(false)
        }
        return
      }

      if (s.type === 'convert-to-fattura' && entityType === 'bolla') {
        const params = new URLSearchParams({ bolla_id: entityId })
        if (fornitoreId) params.set('fornitore_id', fornitoreId)
        close()
        router.push(`/fatture/new?${params.toString()}`)
      } else if (s.type === 'not-invoice' && entityType === 'fattura') {
        close()
      } else if (s.type === 'assign-supplier') {
        close()
        router.push(`/${entityType === 'bolla' ? 'bolle' : 'fatture'}/${entityId}`)
      } else if (s.type === 'add-potential-supplier') {
        setAddingPotentialSupplier(true)
        try {
          const res = await fetch('/api/ai-analysis/potential-supplier', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              entityType,
              entityId,
              supplier_name: s.supplier_name,
              contact_email: s.contact_email,
              contact_phone: s.contact_phone,
              product_types: s.product_types,
              document_type_label: s.document_type_label,
            }),
          })
          const data = await res.json()
          if (!res.ok) {
            showToast(data.error ?? t.aiAnalysisModal.genericError, 'error')
          } else {
            showToast(data.message ?? t.aiAnalysisModal.potentialSupplierRegistered, 'success')
            close()
            router.refresh()
          }
        } catch {
          showToast(t.common.networkError, 'error')
        } finally {
          setAddingPotentialSupplier(false)
        }
      }
    },
    [entityType, entityId, fornitoreId, close, router, doAnalyze, showToast, t],
  )

  if (!open || !mounted) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(2, 6, 23, 0.72)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div
        className="flex max-h-[min(90dvh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f172a] p-0 shadow-[0_4px_40px_rgb(0_0_0/_0.42)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <h2 id={titleId} className="text-sm font-semibold text-white">
            {t.aiAnalysisModal.title}
          </h2>
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/80 transition-colors hover:bg-white/[0.1]"
          >
            {t.aiAnalysisModal.closeBtn}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-sky-400" />
              <div className="flex flex-col gap-2">
                {LOADING_STEPS.map((s, i) => {
                  const isActive = i === activeStepIndex
                  const isDone = i < activeStepIndex
                  return (
                    <div
                      key={s.step}
                      className={`flex items-center gap-2 text-sm ${
                        isDone ? 'text-white/40' : isActive ? 'text-white/80' : 'text-white/30'
                      }`}
                    >
                      <span className="flex w-4 items-center justify-center text-xs">
                        {isDone ? '\u2713' : isActive ? '\u25CF' : '\u25CB'}
                      </span>
                      <span>{s.message}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-red-400">{errorMsg}</p>
              <button
                type="button"
                onClick={doAnalyze}
                className="rounded-lg border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/[0.1]"
              >
                {t.aiAnalysisModal.retryBtn}
              </button>
            </div>
          )}

          {status === 'done' && result && (
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                  {t.aiAnalysisModal.analysisHeading}
                </h3>
                <p className="text-sm leading-relaxed text-white/80">{result.analysis}</p>
              </div>

              {result.suggestions.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
                    {t.aiAnalysisModal.suggestedActionsHeading}
                  </h3>
                  <div className="flex flex-col gap-2">
                    {result.suggestions.map((s, i) => {
                      const cfg = severityConfig[s.type]
                      return (
                        <div
                          key={i}
                          className={`rounded-lg border ${cfg.border} bg-white/[0.03] p-3`}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-base">{cfg.icon}</span>
                            <span className="text-sm font-semibold text-white">
                              {s.label}
                            </span>
                          </div>
                          <p className="mb-2 text-xs leading-relaxed text-white/60">
                            {s.description}
                          </p>
                          {s.type !== 'info' && (
                            <button
                              type="button"
                              onClick={() => handleSuggestionAction(s)}
                              disabled={s.type === 'anomaly' && applyingAnomaly || s.type === 'add-potential-supplier' && addingPotentialSupplier}
                              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                                s.type === 'anomaly' && applyingAnomaly || s.type === 'add-potential-supplier' && addingPotentialSupplier
                                  ? 'cursor-not-allowed opacity-50'
                                  : cfg.btnVariant
                              }`}
                            >
                              {s.type === 'anomaly' && applyingAnomaly ? t.aiAnalysisModal.correcting
                                : s.type === 'add-potential-supplier' && addingPotentialSupplier ? t.aiAnalysisModal.registering
                                : t.aiAnalysisModal.apply}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {result.suggestions.length === 0 && (
                <p className="text-sm text-white/40">{t.aiAnalysisModal.noSuggestions}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
