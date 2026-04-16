'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, ExternalLink, Loader2 } from 'lucide-react'
import { useT } from '@/lib/use-t'
import { extractRekkiSupplierIdFromUrl } from '@/lib/rekki-extract-id'
import { ActionButton, ActionLink } from '@/components/ui/ActionButton'
import { SUMMARY_HIGHLIGHT_ACCENTS } from '@/lib/summary-highlight-accent'
import { createClient } from '@/utils/supabase/client'
import { supplierShortNameForRekkiSearch } from '@/lib/fornitore-display'

// TODO (fase 2 / listino): mappare `rekki_product_id` sulla tabella `listino_prezzi` per il confronto prezzi riga per riga con Rekki.

function resolveRekkiSlugFromIdField(raw: string): string {
  const s = raw.trim()
  const extracted = extractRekkiSupplierIdFromUrl(s)
  if (extracted) return extracted
  if (!s || /^https?:\/\//i.test(s)) return ''
  return s
}

function normalizeRekkiLink(v: string | null | undefined): string | null {
  const t = v?.trim() ?? ''
  return t || null
}

/** Allinea a `edit/page.tsx`: slug da campo ID o, se assente, dall’URL nel link. */
function resolveRekkiSupplierIdForSave(idField: string, linkField: string): string | null {
  const rawRekkiId = idField.trim()
  let rekki_supplier_id =
    (extractRekkiSupplierIdFromUrl(rawRekkiId) ?? rawRekkiId).trim() || null
  if (!rekki_supplier_id) {
    rekki_supplier_id = extractRekkiSupplierIdFromUrl(linkField.trim())?.trim() || null
  }
  return rekki_supplier_id
}

export default function RekkiSupplierIntegration({
  fornitoreId,
  supplierDisplayName,
  initialRekkiId,
  initialRekkiLink,
  className,
  readOnly,
  onSaved,
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
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const saveInFlightRef = useRef(false)

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

  const plannedLink = readOnly ? normalizeRekkiLink(initialRekkiLink) : normalizeRekkiLink(rekkiLink)
  const plannedId = readOnly
    ? resolveRekkiSupplierIdForSave(initialRekkiId ?? '', initialRekkiLink ?? '')
    : resolveRekkiSupplierIdForSave(rekkiId, rekkiLink)
  const initialLinkNorm = normalizeRekkiLink(initialRekkiLink)
  const initialIdNorm = resolveRekkiSupplierIdForSave(initialRekkiId ?? '', initialRekkiLink ?? '')

  const isDirty = useMemo(() => {
    if (readOnly) return false
    const linkEq = (plannedLink ?? '') === (initialLinkNorm ?? '')
    const idEq = (plannedId ?? '') === (initialIdNorm ?? '')
    return !linkEq || !idEq
  }, [readOnly, plannedLink, plannedId, initialLinkNorm, initialIdNorm])

  const rekkiHeaderStatus = useMemo(() => {
    if (isDirty) return 'pending' as const
    if (!rekkiId.trim() && !rekkiLink.trim()) return 'not_connected' as const
    return 'connected' as const
  }, [isDirty, rekkiId, rekkiLink])

  const handleSaveMapping = useCallback(async () => {
    if (readOnly || saveInFlightRef.current) return
    saveInFlightRef.current = true
    setIsSaving(true)
    setSaveError(null)
    try {
      const supabase = createClient()
      const rekki_link = normalizeRekkiLink(rekkiLink)
      const rekki_supplier_id = resolveRekkiSupplierIdForSave(rekkiId, rekkiLink)
      const { error } = await supabase
        .from('fornitori')
        .update({ rekki_link, rekki_supplier_id })
        .eq('id', fornitoreId)
      if (error) {
        setSaveError(error.message)
        return
      }
      setRekkiLink(rekki_link ?? '')
      setRekkiId(rekki_supplier_id ?? '')
      onSaved?.()
    } finally {
      saveInFlightRef.current = false
      setIsSaving(false)
    }
  }, [readOnly, rekkiLink, rekkiId, fornitoreId, onSaved])

  const id_rekki =
    resolveRekkiSlugFromIdField(idValue) ||
    resolveRekkiSlugFromIdField(initialRekkiId?.trim() ?? '') ||
    resolveRekkiSlugFromIdField(linkValue) ||
    resolveRekkiSlugFromIdField(initialRekkiLink?.trim() ?? '')
  const nome_fornitore = useMemo(
    () => supplierShortNameForRekkiSearch(supplierDisplayName),
    [supplierDisplayName],
  )
  const hasRekkiSlug = Boolean(id_rekki)
  const rekkiOpenReady = hasRekkiSlug || nome_fornitore.length >= 2

  const rekkiUrl = useMemo(() => {
    if (!rekkiOpenReady) return '#'
    if (hasRekkiSlug) {
      return `https://rekki.com/gb/food-wholesalers/${encodeURIComponent(id_rekki)}`
    }
    return `https://rekki.com/food-wholesalers/gb?search=${encodeURIComponent(nome_fornitore)}`
  }, [rekkiOpenReady, hasRekkiSlug, id_rekki, nome_fornitore])

  /** Apre Rekki nel browser (scheda/finestra dedicata), senza modale in-app. */
  const externalRekkiHref = useMemo(() => {
    const saved = linkValue.trim()
    if (/^https?:\/\//i.test(saved)) return saved
    return rekkiUrl
  }, [linkValue, rekkiUrl])

  const shell = SUMMARY_HIGHLIGHT_ACCENTS.cyan
  const rekkiShellCls =
    'relative overflow-hidden rounded-2xl bg-transparent text-app-fg shadow-[0_0_20px_-10px_rgba(6,182,212,0.28),0_16px_40px_-14px_rgba(0,0,0,0.22)] ring-1 ring-inset ring-white/10'

  return (
    <div
      className={`${rekkiShellCls} flex min-h-0 flex-1 flex-col overflow-hidden ${shell.border} ${className ?? ''}`}
    >
        <div className={`app-card-bar-accent ${shell.bar}`} aria-hidden />
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-app-line-22 bg-transparent px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <svg className="h-3.5 w-3.5 shrink-0 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-app-fg">
              {t.fornitori.rekkiIntegrationTitle}
            </p>
          </div>
          {rekkiHeaderStatus === 'pending' ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/45 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
              <AlertCircle className="size-3 shrink-0 text-amber-400" strokeWidth={2.25} aria-hidden />
              {t.fornitori.rekkiStatusPending}
            </span>
          ) : rekkiHeaderStatus === 'not_connected' ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/12 bg-app-line-10 px-2 py-0.5 text-[10px] font-semibold text-app-fg-muted">
              {t.fornitori.rekkiStatusNotConnected}
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
              <Check className="size-3 shrink-0 text-emerald-400" strokeWidth={2.5} aria-hidden />
              {t.fornitori.rekkiStatusConnected}
            </span>
          )}
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
              disabled={readOnly || isSaving}
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
                if (readOnly) return
                const v = e.target.value
                const extracted = extractRekkiSupplierIdFromUrl(v)
                setRekkiId(extracted ?? v)
              }}
              readOnly={readOnly}
              disabled={readOnly || isSaving}
              placeholder={t.fornitori.rekkiIdPlaceholder}
              className="w-full rounded-lg border border-app-line-28 app-workspace-inset-bg-soft px-3 py-2 font-mono text-sm text-app-fg focus:outline-none focus:ring-2 focus:ring-violet-500/40 disabled:opacity-70"
            />
          </div>
          {!readOnly && isDirty ? (
            <div className="space-y-2">
              <ActionButton
                type="button"
                intent="outline"
                className="w-full justify-center gap-2"
                disabled={isSaving}
                onClick={() => void handleSaveMapping()}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin pointer-events-none" aria-hidden />
                ) : null}
                {isSaving ? t.fornitori.saving : t.fornitori.rekkiSaveMapping}
              </ActionButton>
              {saveError ? <p className="text-center text-xs text-red-300">{saveError}</p> : null}
            </div>
          ) : null}
          <div className="pt-1">
            {rekkiOpenReady ? (
              <ActionLink
                intent={hasRekkiSlug ? 'integration' : 'outline'}
                className="w-full justify-center gap-2"
                href={externalRekkiHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation()
                }}
              >
                <ExternalLink className="h-4 w-4 shrink-0 pointer-events-none" aria-hidden />
                {hasRekkiSlug ? t.fornitori.rekkiOpenInApp : t.fornitori.rekkiSearchOnRekkiGoogle}
              </ActionLink>
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
  )
}
