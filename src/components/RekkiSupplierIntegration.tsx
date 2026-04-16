'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@/lib/use-t'
import { extractRekkiSupplierIdFromUrl } from '@/lib/rekki-extract-id'
import { ActionButton } from '@/components/ui/ActionButton'
import { buildGoogleSiteRekkiSearchUrlForCompany, type RekkiLookupFallbackHints } from '@/lib/rekki-supplier-lookup'
import { SUMMARY_HIGHLIGHT_ACCENTS } from '@/lib/summary-highlight-accent'

type RekkiHit = { id: string; name: string }

function RekkiOpenGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
      />
    </svg>
  )
}

function resolveRekkiSlugFromIdField(raw: string): string {
  const t = raw.trim()
  const extracted = extractRekkiSupplierIdFromUrl(t)
  if (extracted) return extracted
  if (!t || /^https?:\/\//i.test(t)) return ''
  return t
}

/** Popup centrato: evita iframe / X-Frame-Options su Rekki e Google. */
function openCenteredExternalWindow(url: string) {
  const w = 1000
  const h = 900
  const sx = window.screenLeft ?? window.screenX ?? 0
  const sy = window.screenTop ?? window.screenY ?? 0
  const vw = window.innerWidth ?? document.documentElement.clientWidth ?? window.screen.width
  const vh = window.innerHeight ?? document.documentElement.clientHeight ?? window.screen.height
  const left = Math.max(0, Math.round(vw / 2 - w / 2 + sx))
  const top = Math.max(0, Math.round(vh / 2 - h / 2 + sy))
  const features = [`width=${w}`, `height=${h}`, `left=${left}`, `top=${top}`, 'location=yes', 'resizable=yes'].join(
    ',',
  )
  window.open(url, 'rekkiSupplierExternal', features)
}

export default function RekkiSupplierIntegration({
  fornitoreId,
  piva,
  supplierDisplayName,
  initialRekkiId,
  initialRekkiLink,
  onSaved,
  className,
  compactFields,
  readOnly,
}: {
  fornitoreId: string
  piva: string | null
  /** Ragione sociale / nome: ricerca Google fallback e hint. */
  supplierDisplayName?: string | null
  initialRekkiId?: string | null
  initialRekkiLink?: string | null
  onSaved?: () => void
  /** Es. `h-full min-h-0 flex flex-col` dentro griglia a tessere. */
  className?: string
  /** Campi ID/link in colonna singola (tile stretti). */
  compactFields?: boolean
  /** Solo lettura: nessuna modifica mapping Rekki (es. mobile operatore). */
  readOnly?: boolean
}) {
  const t = useT()
  const [rekkiId, setRekkiId] = useState(initialRekkiId?.trim() ?? '')
  const [lookupMsg, setLookupMsg] = useState<string | null>(null)
  const [hits, setHits] = useState<RekkiHit[]>([])
  const [fallbackHints, setFallbackHints] = useState<RekkiLookupFallbackHints | null>(null)
  const [loading, setLoading] = useState<'lookup' | 'save' | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  /** Evita doppio POST lookup prima che `disabled` si aggiorni sul bottone API. */
  const lookupInFlightRef = useRef(false)

  useEffect(() => {
    const nextId = initialRekkiId?.trim() ?? ''
    if (nextId) {
      setRekkiId(nextId)
    } else {
      const fromLink = extractRekkiSupplierIdFromUrl(initialRekkiLink?.trim() ?? '')
      setRekkiId(fromLink ?? '')
    }
  }, [fornitoreId, initialRekkiId, initialRekkiLink])

  const persistMapping = async (rid: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/fornitore-rekki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          fornitore_id: fornitoreId,
          rekki_supplier_id: rid,
        }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        const msg = j.error ?? t.common.error
        console.error('[RekkiSupplierIntegration] persistMapping failed', {
          status: res.status,
          error: msg,
          body: j,
        })
        return msg
      }
      return null
    } catch (e) {
      console.error('[RekkiSupplierIntegration] persistMapping network/parse error', e)
      return t.ui.networkError
    }
  }

  const lookup = async () => {
    if (!piva?.trim()) {
      setLookupMsg(t.fornitori.rekkiLookupNeedVat)
      setFallbackHints(null)
      return
    }
    if (lookupInFlightRef.current || loading !== null) return
    lookupInFlightRef.current = true
    const hadNoRekkiId = !rekkiId.trim()
    setLoading('lookup')
    setLookupMsg(null)
    setSaveError(null)
    setHits([])
    setFallbackHints(null)
    try {
      const res = await fetch('/api/fornitore-rekki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lookup',
          piva,
          supplierName: supplierDisplayName ?? null,
        }),
      })
      const j = (await res.json()) as {
        suppliers?: RekkiHit[]
        message?: string
        fallback?: RekkiLookupFallbackHints | null
      }
      const suppliers = Array.isArray(j.suppliers) ? j.suppliers : []
      setFallbackHints(j.fallback ?? null)

      if (suppliers.length === 1 && hadNoRekkiId) {
        const only = suppliers[0]
        setRekkiId(only.id)
        setHits([])
        setLoading('save')
        const err = await persistMapping(only.id)
        if (err) {
          setLookupMsg(err)
          setSaveError(err)
          setHits(suppliers)
        } else {
          setLookupMsg(t.fornitori.rekkiAutoLinkedSingle)
          onSaved?.()
        }
        setLoading(null)
        return
      }

      setHits(suppliers)
      setLookupMsg(j.message ?? null)
    } catch {
      setLookupMsg(t.ui.networkError)
    } finally {
      lookupInFlightRef.current = false
      setLoading(null)
    }
  }

  const save = async () => {
    setSaveError(null)
    const trimmed = rekkiId.trim()
    const extracted = extractRekkiSupplierIdFromUrl(trimmed)
    const rid = (extracted ?? trimmed).trim()
    if (!rid) return
    if (
      !extracted &&
      (/^https?:\/\//i.test(trimmed) || /rekki\.(com|app)/i.test(trimmed))
    ) {
      setSaveError(t.fornitori.rekkiIdUrlNotParsed)
      return
    }
    if (extracted) setRekkiId(extracted)
    setLoading('save')
    try {
      const err = await persistMapping(rid)
      if (err) {
        setSaveError(err)
        return
      }
      onSaved?.()
    } finally {
      setLoading(null)
    }
  }

  const shell = SUMMARY_HIGHLIGHT_ACCENTS.cyan

  /** Stesso filo della scheda modifica fornitore: contorno + ombra, corpo trasparente sul canvas. */
  const rekkiShellCls =
    'relative overflow-hidden rounded-2xl bg-transparent text-app-fg shadow-[0_0_20px_-10px_rgba(6,182,212,0.28),0_16px_40px_-14px_rgba(0,0,0,0.22)] ring-1 ring-inset ring-white/10'

  const resolvedSlug = useMemo(() => resolveRekkiSlugFromIdField(rekkiId), [rekkiId])
  const rekkiProfileUrl = useMemo(() => {
    if (!resolvedSlug) return null
    return `https://rekki.com/gb/food-wholesalers/${encodeURIComponent(resolvedSlug)}`
  }, [resolvedSlug])
  const googleSiteRekkiByNameUrl = useMemo(
    () => buildGoogleSiteRekkiSearchUrlForCompany(supplierDisplayName ?? ''),
    [supplierDisplayName],
  )

  const unifiedPrimaryEnabled = rekkiProfileUrl != null
  const unifiedFallbackEnabled = googleSiteRekkiByNameUrl != null

  const showGuidedPaste =
    fallbackHints != null ||
    (Boolean(lookupMsg) &&
      hits.length === 0 &&
      lookupMsg !== t.fornitori.rekkiAutoLinkedSingle &&
      lookupMsg !== t.fornitori.rekkiLookupNeedVat)

  const openUnified = useCallback(() => {
    if (rekkiProfileUrl) {
      openCenteredExternalWindow(rekkiProfileUrl)
      return
    }
    if (googleSiteRekkiByNameUrl) {
      openCenteredExternalWindow(googleSiteRekkiByNameUrl)
    }
  }, [rekkiProfileUrl, googleSiteRekkiByNameUrl])

  if (readOnly) {
    const id = initialRekkiId?.trim() ?? rekkiId.trim()
    const link = initialRekkiLink?.trim() ?? ''
    return (
      <div
        className={`${rekkiShellCls} flex min-h-0 flex-1 flex-col overflow-hidden ${shell.border} ${className ?? ''}`}
      >
        <div className={`app-card-bar-accent ${shell.bar}`} aria-hidden />
        <div className="flex shrink-0 items-center gap-2 border-b border-app-line-22 bg-transparent px-5 py-3">
          <svg className="h-3.5 w-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <p className="text-xs font-semibold uppercase tracking-wide text-app-fg">{t.fornitori.rekkiIntegrationTitle}</p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-transparent px-5 py-4 text-sm text-app-fg-muted">
          {id || link ? (
            <>
              {id ? (
                <p>
                  <span className="text-[10px] font-semibold uppercase text-app-fg-muted">{t.fornitori.rekkiIdLabel}</span>{' '}
                  <span className="font-mono text-app-fg">{id}</span>
                </p>
              ) : null}
              {link ? (
                <p className="break-words">
                  <span className="text-[10px] font-semibold uppercase text-app-fg-muted">{t.fornitori.rekkiLinkLabel}</span>{' '}
                  <span className="text-app-fg-muted">{link}</span>
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-xs italic text-app-fg-muted">—</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`${rekkiShellCls} flex min-h-0 flex-1 flex-col overflow-hidden ${shell.border} ${className ?? ''}`}
    >
      <div className={`app-card-bar-accent ${shell.bar}`} aria-hidden />
      <div className="flex shrink-0 items-center gap-2 border-b border-app-line-22 bg-transparent px-5 py-3">
        <svg className="h-3.5 w-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <p className="text-xs font-semibold uppercase tracking-wide text-app-fg">{t.fornitori.rekkiIntegrationTitle}</p>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-transparent px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              intent={unifiedPrimaryEnabled ? 'integration' : 'outline'}
              size="sm"
              type="button"
              disabled={loading !== null || (!unifiedPrimaryEnabled && !unifiedFallbackEnabled)}
              onClick={(e) => {
                e.stopPropagation()
                openUnified()
              }}
            >
              <RekkiOpenGlyph className="size-3.5 shrink-0 opacity-90" />
              {unifiedPrimaryEnabled ? t.fornitori.rekkiOpenInApp : t.fornitori.rekkiSearchOnRekkiGoogle}
            </ActionButton>
            {piva?.trim() ? (
              <span className="font-mono text-[11px] text-app-fg-muted">VAT: {piva}</span>
            ) : (
              <span className="text-[11px] text-amber-400/90">{t.fornitori.rekkiLookupNeedVat}</span>
            )}
          </div>
          {piva?.trim() ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                void lookup()
              }}
              disabled={loading !== null}
              aria-busy={loading === 'lookup'}
              className="inline-flex items-center gap-1.5 self-start text-[11px] font-semibold text-violet-300/90 underline decoration-violet-500/40 underline-offset-2 hover:text-violet-200 disabled:pointer-events-none disabled:opacity-40"
            >
              {loading === 'lookup' ? (
                <>
                  <svg
                    className="size-3 shrink-0 animate-spin text-violet-200"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  <span>{t.common.loading}</span>
                </>
              ) : (
                t.fornitori.rekkiLookupApiLink
              )}
            </button>
          ) : null}
        </div>
        {lookupMsg && <p className="text-xs text-app-fg-muted">{lookupMsg}</p>}
        {saveError && (
          <p
            role="alert"
            className="rounded-lg border border-red-500/40 bg-red-950/35 px-3 py-2 text-xs leading-relaxed text-red-100"
          >
            {saveError}
          </p>
        )}
        {fallbackHints?.envSetupHint ? (
          <p className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-[11px] leading-relaxed text-amber-100/95">
            {fallbackHints.envSetupHint}
          </p>
        ) : null}
        {showGuidedPaste ? (
          <p className="text-[11px] leading-relaxed text-app-fg-muted">{t.fornitori.rekkiGuidedPasteHint}</p>
        ) : null}
        {hits.length > 0 && (
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-app-line-22 app-workspace-inset-bg-soft p-2">
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setRekkiId(h.id)
                  }}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs text-app-fg-muted transition-colors hover:bg-black/18"
                >
                  <span className="font-mono text-violet-300">{h.id}</span>
                  <span className="ml-2 text-app-fg-muted">{h.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase text-app-fg-muted">{t.fornitori.rekkiIdLabel}</label>
          <input
            type="text"
            value={rekkiId}
            onChange={(e) => setRekkiId(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData?.getData('text/plain')?.trim() ?? ''
              if (!pasted) return
              const fromPaste = extractRekkiSupplierIdFromUrl(pasted)
              if (!fromPaste) return
              window.setTimeout(() => {
                setRekkiId(fromPaste)
                setLookupMsg(t.fornitori.rekkiIdExtractedFromLink)
              }, 0)
            }}
            placeholder={t.fornitori.rekkiIdPlaceholder}
            className={`w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 font-mono text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-violet-500/40${compactFields ? ' min-w-0' : ''}`}
          />
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={loading !== null || !rekkiId.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-app-cyan-500 disabled:opacity-40"
        >
          {loading === 'save' ? (
            <>
              <svg className="size-3.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-90"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              <span>{t.common.loading}</span>
            </>
          ) : (
            t.fornitori.rekkiSaveRekkiMapping
          )}
        </button>
      </div>
    </div>
  )
}
