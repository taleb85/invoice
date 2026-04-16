'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { useT } from '@/lib/use-t'
import { extractRekkiSupplierIdFromUrl } from '@/lib/rekki-extract-id'
import { ActionButton, ActionLink } from '@/components/ui/ActionButton'
import { AppSheet } from '@/components/ui/AppSheet'
import { SUMMARY_HIGHLIGHT_ACCENTS } from '@/lib/summary-highlight-accent'

function resolveRekkiSlugFromIdField(raw: string): string {
  const s = raw.trim()
  const extracted = extractRekkiSupplierIdFromUrl(s)
  if (extracted) return extracted
  if (!s || /^https?:\/\//i.test(s)) return ''
  return s
}

export default function RekkiSupplierIntegration({
  fornitoreId,
  supplierDisplayName,
  initialRekkiId,
  initialRekkiLink,
  className,
  readOnly,
}: {
  fornitoreId: string
  piva: string | null
  supplierDisplayName?: string | null
  initialRekkiId?: string | null
  initialRekkiLink?: string | null
  onSaved?: () => void
  className?: string
  compactFields?: boolean
  readOnly?: boolean
}) {
  const t = useT()
  const [rekkiId, setRekkiId] = useState(() => initialRekkiId?.trim() ?? '')
  const [rekkiLink, setRekkiLink] = useState(() => initialRekkiLink?.trim() ?? '')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetSrc, setSheetSrc] = useState<string | null>(null)
  const [pagePreview, setPagePreview] = useState<{
    title: string | null
    description: string | null
    image: string | null
  } | null>(null)
  const [pagePreviewLoading, setPagePreviewLoading] = useState(false)

  useEffect(() => {
    if (readOnly) return
    const fromServer = initialRekkiId?.trim()
    if (!fromServer) return
    setRekkiId((prev) => (prev.trim() === '' ? fromServer : prev))
  }, [fornitoreId, readOnly, initialRekkiId])

  useEffect(() => {
    if (readOnly) return
    const fromServer = initialRekkiLink?.trim()
    if (!fromServer) return
    setRekkiLink((prev) => (prev.trim() === '' ? fromServer : prev))
  }, [fornitoreId, readOnly, initialRekkiLink])

  const idValue = readOnly ? (initialRekkiId?.trim() ?? '') : rekkiId
  const linkValue = readOnly ? (initialRekkiLink?.trim() ?? '') : rekkiLink

  const onRekkiLinkChange = useCallback(
    (raw: string) => {
      if (readOnly) return
      setRekkiLink(raw)
      const extracted = extractRekkiSupplierIdFromUrl(raw)
      if (extracted) setRekkiId(extracted)
    },
    [readOnly],
  )

  const id_rekki =
    resolveRekkiSlugFromIdField(idValue) ||
    resolveRekkiSlugFromIdField(initialRekkiId?.trim() ?? '') ||
    resolveRekkiSlugFromIdField(linkValue) ||
    resolveRekkiSlugFromIdField(initialRekkiLink?.trim() ?? '')
  const nome_fornitore = (supplierDisplayName ?? '').replace(/\s+/g, ' ').trim()
  const hasRekkiSlug = Boolean(id_rekki)
  const rekkiOpenReady = hasRekkiSlug || nome_fornitore.length >= 2

  const rekkiUrl = useMemo(() => {
    if (!rekkiOpenReady) return '#'
    if (hasRekkiSlug) {
      return `https://rekki.com/gb/food-wholesalers/${encodeURIComponent(id_rekki)}`
    }
    return `https://rekki.com/food-wholesalers/gb?search=${encodeURIComponent(nome_fornitore)}`
  }, [rekkiOpenReady, hasRekkiSlug, id_rekki, nome_fornitore])

  const openRekkiSheet = useCallback(() => {
    if (!rekkiOpenReady || rekkiUrl === '#') return
    setSheetSrc(rekkiUrl)
    setSheetOpen(true)
  }, [rekkiOpenReady, rekkiUrl])

  const closeSheet = useCallback((open: boolean) => {
    setSheetOpen(open)
    if (!open) {
      setSheetSrc(null)
      setPagePreview(null)
      setPagePreviewLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!sheetOpen || !sheetSrc) {
      setPagePreview(null)
      setPagePreviewLoading(false)
      return
    }
    const ac = new AbortController()
    let cancelled = false
    setPagePreview(null)
    setPagePreviewLoading(true)
    fetch(`/api/rekki-page-preview?url=${encodeURIComponent(sheetSrc)}`, { signal: ac.signal })
      .then(async (r) => {
        if (!r.ok) return { title: null, description: null, image: null }
        return (await r.json()) as { title: string | null; description: string | null; image: string | null }
      })
      .then((data) => {
        if (!cancelled) setPagePreview(data)
      })
      .catch((err: unknown) => {
        if (cancelled || (err instanceof DOMException && err.name === 'AbortError')) return
        if (!cancelled) setPagePreview({ title: null, description: null, image: null })
      })
      .finally(() => {
        if (!cancelled) setPagePreviewLoading(false)
      })
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [sheetOpen, sheetSrc])

  const shell = SUMMARY_HIGHLIGHT_ACCENTS.cyan
  const rekkiShellCls =
    'relative overflow-hidden rounded-2xl bg-transparent text-app-fg shadow-[0_0_20px_-10px_rgba(6,182,212,0.28),0_16px_40px_-14px_rgba(0,0,0,0.22)] ring-1 ring-inset ring-white/10'

  return (
    <>
      <div
        className={`${rekkiShellCls} flex min-h-0 flex-1 flex-col overflow-hidden ${shell.border} ${className ?? ''}`}
      >
        <div className={`app-card-bar-accent ${shell.bar}`} aria-hidden />
        <div className="flex shrink-0 items-center gap-2 border-b border-app-line-22 bg-transparent px-5 py-3">
          <svg className="h-3.5 w-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <p className="text-xs font-semibold uppercase tracking-wide text-app-fg">{t.fornitori.rekkiIntegrationTitle}</p>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-transparent px-5 py-4">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-app-fg-muted">
              {t.fornitori.rekkiLinkLabel}
            </label>
            <input
              type="text"
              value={linkValue}
              onChange={(e) => onRekkiLinkChange(e.target.value)}
              readOnly={readOnly}
              disabled={readOnly}
              placeholder={t.fornitori.rekkiLinkPlaceholder}
              className="w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-70"
              inputMode="url"
              autoComplete="url"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase text-app-fg-muted">
              {t.fornitori.rekkiIdLabel}
            </label>
            <input
              type="text"
              value={idValue}
              onChange={(e) => {
                if (!readOnly) setRekkiId(e.target.value)
              }}
              readOnly={readOnly}
              disabled={readOnly}
              placeholder={t.fornitori.rekkiIdPlaceholder}
              className="w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 font-mono text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-70"
            />
          </div>
          <div className="pt-1">
            {rekkiOpenReady ? (
              <ActionButton
                type="button"
                intent={hasRekkiSlug ? 'integration' : 'outline'}
                className="w-full justify-center gap-2"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  openRekkiSheet()
                }}
              >
                <ExternalLink className="h-4 w-4 shrink-0 pointer-events-none" aria-hidden />
                {hasRekkiSlug ? t.fornitori.rekkiOpenInApp : t.fornitori.rekkiSearchOnRekkiGoogle}
              </ActionButton>
            ) : (
              <ActionButton
                type="button"
                intent="outline"
                className="w-full justify-center gap-2"
                disabled
              >
                <ExternalLink className="h-4 w-4 shrink-0 pointer-events-none" aria-hidden />
                {t.fornitori.rekkiSearchOnRekkiGoogle}
              </ActionButton>
            )}
          </div>
        </div>
      </div>

      <AppSheet
        open={sheetOpen}
        onOpenChange={closeSheet}
        title={t.fornitori.rekkiEmbedPanelTitle}
        closeLabel={t.statements.btnClose}
        scrimCloseLabel={t.statements.btnClose}
        variant="center"
        size="wide"
        bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
      >
        {sheetSrc ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto border-b border-app-line-22 bg-slate-900/60 px-4 py-4 sm:px-5">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">
                {t.fornitori.rekkiSheetPagePreviewCaption}
              </p>
              {pagePreviewLoading ? (
                <p className="text-xs text-app-fg-muted">{t.fornitori.rekkiSheetPagePreviewLoading}</p>
              ) : null}
              {!pagePreviewLoading && pagePreview ? (
                <div className="space-y-3">
                  {pagePreview.image ? (
                    <img
                      src={pagePreview.image}
                      alt=""
                      className="max-h-[min(42vh,20rem)] w-full rounded-lg border border-app-line-28 object-contain object-left"
                    />
                  ) : null}
                  {pagePreview.title ? (
                    <p className="text-base font-semibold leading-snug text-app-fg">{pagePreview.title}</p>
                  ) : null}
                  {pagePreview.description ? (
                    <p className="line-clamp-6 text-sm leading-relaxed text-app-fg-muted">{pagePreview.description}</p>
                  ) : null}
                  {!pagePreview.image && !pagePreview.title && !pagePreview.description ? (
                    <p className="text-sm text-app-fg-muted">{t.fornitori.rekkiSheetPagePreviewUnavailable}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="shrink-0 space-y-3 border-t border-app-line-22 bg-slate-950 px-4 py-3 sm:px-5">
              <p className="text-xs leading-relaxed text-app-fg-muted">{t.fornitori.rekkiSheetEmbedHint}</p>
              <p className="break-all rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-2.5 py-2 font-mono text-[11px] text-app-fg-muted">
                {sheetSrc}
              </p>
              <ActionLink
                intent="integration"
                className="w-full justify-center gap-2"
                href={sheetSrc}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="h-4 w-4 shrink-0 pointer-events-none" aria-hidden />
                {t.fornitori.rekkiSheetPopupButton}
              </ActionLink>
            </div>
          </div>
        ) : null}
      </AppSheet>
    </>
  )
}
