'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/use-t'
import { extractRekkiSupplierIdFromUrl } from '@/lib/rekki-extract-id'
import {
  buildGoogleSiteRekkiSearchUrlForCompany,
  buildGoogleSiteRekkiSearchUrlForVat,
  type RekkiLookupFallbackHints,
} from '@/lib/rekki-supplier-lookup'
import { SUMMARY_HIGHLIGHT_ACCENTS } from '@/lib/summary-highlight-accent'

type RekkiHit = { id: string; name: string }

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
  const [rekkiLink, setRekkiLink] = useState(initialRekkiLink?.trim() ?? '')
  const [lookupMsg, setLookupMsg] = useState<string | null>(null)
  const [hits, setHits] = useState<RekkiHit[]>([])
  const [fallbackHints, setFallbackHints] = useState<RekkiLookupFallbackHints | null>(null)
  const [loading, setLoading] = useState<'lookup' | 'save' | null>(null)
  const extractTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const nextLink = initialRekkiLink?.trim() ?? ''
    const nextId = initialRekkiId?.trim() ?? ''
    setRekkiLink(nextLink)
    if (nextId) {
      setRekkiId(nextId)
    } else {
      const extracted = extractRekkiSupplierIdFromUrl(nextLink)
      setRekkiId(extracted ?? '')
    }
  }, [fornitoreId, initialRekkiId, initialRekkiLink])

  const persistMapping = async (
    rid: string,
    linkTrim: string | null,
  ): Promise<string | null> => {
    try {
      const res = await fetch('/api/fornitore-rekki', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          fornitore_id: fornitoreId,
          rekki_supplier_id: rid,
          rekki_link: linkTrim,
        }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) return j.error ?? t.common.error
      return null
    } catch {
      return t.ui.networkError
    }
  }

  const applyIdFromLink = useCallback(() => {
    const extracted = extractRekkiSupplierIdFromUrl(rekkiLink)
    if (!extracted) return
    if (extracted === rekkiId.trim()) return
    setRekkiId(extracted)
    setLookupMsg(t.fornitori.rekkiIdExtractedFromLink)
  }, [rekkiLink, rekkiId, t.fornitori.rekkiIdExtractedFromLink])

  /** Estrazione immediata mentre si incolla / si modifica il link (debounce leggero). */
  useEffect(() => {
    if (extractTimer.current) clearTimeout(extractTimer.current)
    extractTimer.current = setTimeout(() => {
      const extracted = extractRekkiSupplierIdFromUrl(rekkiLink)
      if (extracted && extracted !== rekkiId.trim()) {
        setRekkiId(extracted)
        setLookupMsg(t.fornitori.rekkiIdExtractedFromLink)
      }
    }, 120)
    return () => {
      if (extractTimer.current) clearTimeout(extractTimer.current)
    }
  }, [rekkiLink, rekkiId, t.fornitori.rekkiIdExtractedFromLink])

  const openGoogleRekkiByVat = () => {
    const u = buildGoogleSiteRekkiSearchUrlForVat(piva ?? '')
    if (u) window.open(u, '_blank', 'noopener,noreferrer')
  }

  const openGoogleRekkiByName = () => {
    const u = buildGoogleSiteRekkiSearchUrlForCompany(supplierDisplayName ?? '')
    if (u) window.open(u, '_blank', 'noopener,noreferrer')
  }

  const lookup = async () => {
    if (!piva?.trim()) {
      setLookupMsg(t.fornitori.rekkiLookupNeedVat)
      setFallbackHints(null)
      return
    }
    const hadNoRekkiId = !rekkiId.trim()
    setLoading('lookup')
    setLookupMsg(null)
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
        const err = await persistMapping(only.id, rekkiLink.trim() || null)
        if (err) {
          setLookupMsg(err)
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
      setLoading(null)
    }
  }

  const save = async () => {
    const rid = rekkiId.trim()
    if (!rid) return
    setLoading('save')
    try {
      const err = await persistMapping(rid, rekkiLink.trim() || null)
      if (err) {
        alert(err)
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

  const vatSearchAvailable = (piva ?? '').replace(/\D/g, '').length >= 7
  const nameSearchAvailable = (supplierDisplayName ?? '').trim().length >= 2
  const showGuidedPaste =
    fallbackHints != null ||
    (Boolean(lookupMsg) &&
      hits.length === 0 &&
      lookupMsg !== t.fornitori.rekkiAutoLinkedSingle &&
      lookupMsg !== t.fornitori.rekkiLookupNeedVat)

  if (readOnly) {
    const id = initialRekkiId?.trim() ?? rekkiId.trim()
    const link = initialRekkiLink?.trim() ?? rekkiLink.trim()
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
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void lookup()}
            disabled={loading !== null}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-40"
          >
            {loading === 'lookup' ? t.common.loading : t.fornitori.rekkiLookupByVat}
          </button>
          {vatSearchAvailable ? (
            <button
              type="button"
              onClick={() => openGoogleRekkiByVat()}
              disabled={loading !== null}
              className="rounded-lg border border-violet-500/45 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-100 transition-colors hover:bg-violet-500/18 disabled:opacity-40"
            >
              {t.fornitori.rekkiSearchOnRekkiGoogle}
            </button>
          ) : null}
          {nameSearchAvailable ? (
            <button
              type="button"
              onClick={() => openGoogleRekkiByName()}
              disabled={loading !== null}
              className="rounded-lg border border-app-line-28 bg-transparent px-3 py-2 text-xs font-semibold text-app-fg-muted transition-colors hover:bg-white/[0.06] disabled:opacity-40"
            >
              {t.fornitori.rekkiSearchOnRekkiGoogleByName}
            </button>
          ) : null}
          {piva?.trim() ? (
            <span className="font-mono text-[11px] text-app-fg-muted">VAT: {piva}</span>
          ) : (
            <span className="text-[11px] text-amber-400/90">{t.fornitori.rekkiLookupNeedVat}</span>
          )}
        </div>
        {lookupMsg && <p className="text-xs text-app-fg-muted">{lookupMsg}</p>}
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
                  onClick={() => setRekkiId(h.id)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs text-app-fg-muted transition-colors hover:bg-black/18"
                >
                  <span className="font-mono text-violet-300">{h.id}</span>
                  <span className="ml-2 text-app-fg-muted">{h.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={`grid gap-3 ${compactFields ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-app-fg-muted">{t.fornitori.rekkiIdLabel}</label>
            <input
              type="text"
              value={rekkiId}
              onChange={(e) => setRekkiId(e.target.value)}
              placeholder={t.fornitori.rekkiIdPlaceholder}
              className="w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 font-mono text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-app-fg-muted">{t.fornitori.rekkiLinkLabel}</label>
            <input
              type="url"
              value={rekkiLink}
              onChange={(e) => setRekkiLink(e.target.value)}
              onBlur={() => applyIdFromLink()}
              onPaste={(e) => {
                const pasted = e.clipboardData?.getData('text/plain')?.trim() ?? ''
                if (!pasted) return
                const extracted = extractRekkiSupplierIdFromUrl(pasted)
                if (!extracted) return
                window.setTimeout(() => {
                  setRekkiId(extracted)
                  setLookupMsg(t.fornitori.rekkiIdExtractedFromLink)
                }, 0)
              }}
              placeholder={t.fornitori.rekkiLinkPlaceholder}
              className="w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={loading !== null || !rekkiId.trim()}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-app-cyan-500 disabled:opacity-40"
        >
          {loading === 'save' ? t.common.saving : t.fornitori.rekkiSaveRekkiMapping}
        </button>
      </div>
    </div>
  )
}
