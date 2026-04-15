'use client'

import { useState, useEffect, useRef, useMemo, useId } from 'react'
import { useT } from '@/lib/use-t'
import { useRouter } from 'next/navigation'
import { useMe } from '@/lib/me-context'
import { useEmailSyncProgressOptional } from '@/components/EmailSyncProgressProvider'
import {
  readEmailSyncScopePrefs,
  writeEmailSyncScopePrefs,
  emailSyncApiBodyFields,
  type EmailSyncDocumentKind,
  type EmailSyncScopePrefs,
} from '@/lib/email-sync-scope-prefs'
import { defaultFiscalYearLabel } from '@/lib/fiscal-year'

/** Giorni predefiniti per l’override lookback (oltre al default sede). */
const LOOKBACK_DAY_PRESETS = [3, 7, 14, 30, 60, 90] as const

interface Props {
  /**
   * `desktopHeader`: solo pulsante in barra; filtri e avvio sync in pannello popup.
   * `default`: layout pagina / card (tutto in linea).
   */
  placement?: 'default' | 'desktopHeader'
  /** Classi aggiuntive sul wrapper radice */
  className?: string
  /** Se true mostra sempre il testo (non solo su desktop) */
  alwaysShowLabel?: boolean
  /**
   * When provided (e.g. from /sedi/[sede_id]/page.tsx URL params), the scan is
   * scoped to this specific branch — skips the /api/me lookup entirely.
   */
  sedeId?: string
  /** Sincronizzazione mirata al fornitore (casella = sede del fornitore). */
  fornitoreId?: string
  /** Es. assenza sede sul fornitore — disabilita oltre allo stato interno. */
  disabled?: boolean
  /** Tooltip quando `disabled` è true (es. serve sede sul fornitore). */
  disabledReasonTitle?: string
  /** `supplier`: stile allineato alla barra fornitore (bordi cyan / sfondo tenue). */
  variant?: 'default' | 'supplier'
}

export default function ScanEmailButton({
  placement = 'default',
  className: classNameProp,
  alwaysShowLabel = false,
  sedeId: propSedeId,
  fornitoreId,
  disabled: disabledProp,
  disabledReasonTitle,
  variant = 'default',
}: Props) {
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'warn' | 'error'; text: string } | null>(null)
  const [scopePrefs, setScopePrefs] = useState<EmailSyncScopePrefs>(() => readEmailSyncScopePrefs())
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const headerWrapRef = useRef<HTMLDivElement>(null)
  const headerMenuId = useId()
  const fallbackSedeIdRef = useRef<string | null>(null)
  const t = useT()
  const router = useRouter()
  const { me } = useMe()
  const emailSync = useEmailSyncProgressOptional()
  /** Stringa stabile: evita dipendenze `useEffect` di lunghezza incoerente (strict / HMR). */
  const countryCodeKey = me?.country_code ?? ''
  const sedeIdKey = me?.sede_id ?? ''

  const fiscalYearOptions = useMemo(() => {
    const current = defaultFiscalYearLabel(countryCodeKey || 'UK', new Date())
    return Array.from({ length: 8 }, (_, i) => current - i)
  }, [countryCodeKey])

  useEffect(() => {
    setScopePrefs(readEmailSyncScopePrefs())
  }, [])

  useEffect(() => {
    const p = readEmailSyncScopePrefs()
    const current = defaultFiscalYearLabel(countryCodeKey || 'UK', new Date())
    const oldest = current - 7
    if (p.mode === 'fiscal_year') {
      const y = Math.min(current, Math.max(oldest, p.fiscalYear))
      if (y !== p.fiscalYear) {
        const fixed = {
          mode: 'fiscal_year' as const,
          fiscalYear: y,
          lookbackDays: p.lookbackDays ?? null,
          documentKind: p.documentKind ?? 'all',
        }
        writeEmailSyncScopePrefs(fixed)
        setScopePrefs(fixed)
        return
      }
    }
    setScopePrefs(p)
  }, [countryCodeKey])

  // Populate fallback sede_id from shared context — no extra /api/me fetch
  useEffect(() => {
    if (propSedeId) return
    if (sedeIdKey) fallbackSedeIdRef.current = sedeIdKey
  }, [propSedeId, sedeIdKey])

  const handleClick = async () => {
    setLoading(true)
    setToast(null)
    try {
      const effectiveSedeId = propSedeId ?? fallbackSedeIdRef.current
      const scopeFields = emailSyncApiBodyFields(scopePrefs)
      const payload = {
        ...scopeFields,
        ...(fornitoreId ? { fornitore_id: fornitoreId } : {}),
        ...(effectiveSedeId
          ? {
              user_sede_id: effectiveSedeId,
              filter_sede_id: propSedeId ?? undefined,
            }
          : {}),
      }

      if (emailSync) {
        await emailSync.runEmailSync(payload)
      } else {
        const body = JSON.stringify(payload)
        const res = await fetch('/api/scan-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        })
        const json = await res.json()

        if (!res.ok) {
          setToast({ type: 'error', text: json.error ?? t.ui.syncError })
        } else {
          const tipo = json.avvisi?.length ? 'warn' : 'ok'
          setToast({ type: tipo, text: json.messaggio ?? t.ui.syncSuccess })
          router.refresh()
        }
      }
    } catch {
      setToast({ type: 'error', text: t.ui.networkError })
    } finally {
      setLoading(false)
      if (!emailSync) setTimeout(() => setToast(null), 5000)
    }
  }

  const isHeaderPlacement = placement === 'desktopHeader'
  const labelVis = alwaysShowLabel ? '' : 'hidden md:inline'
  const isSupplierVariant = variant === 'supplier' && !isHeaderPlacement

  useEffect(() => {
    if (!isHeaderPlacement || !headerMenuOpen) return
    const onDoc = (e: MouseEvent) => {
      const el = headerWrapRef.current
      if (el && !el.contains(e.target as Node)) setHeaderMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHeaderMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [isHeaderPlacement, headerMenuOpen])

  const selectSize =
    'h-9 py-0 pl-2.5 pr-8 text-left text-xs font-medium leading-9'
  const selectSizeSupplier =
    'h-6 py-0 pl-1 pr-5 text-left text-[10px] font-medium leading-6 md:pl-1.5 md:pr-6 md:text-[11px] xl:h-9 xl:pl-2 xl:pr-8 xl:text-[11px] xl:leading-9'
  const selectSizeSupplierLookback =
    'h-6 py-0 pl-0.5 pr-4 text-left text-[10px] font-medium leading-6 md:pl-1 md:pr-5 md:text-[11px] xl:h-9 xl:pl-1.5 xl:pr-7 xl:text-[11px] xl:leading-9'

  const headerTriggerBtnCls =
    'inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-cyan-400/50 bg-cyan-500/25 px-2 text-[10px] font-bold text-cyan-50 shadow-sm shadow-cyan-950/40 transition-colors hover:bg-cyan-500/35 active:bg-cyan-500/30 whitespace-nowrap sm:px-2.5 sm:text-[11px]'

  const selectOptionSurface = 'bg-slate-700 text-slate-100'
  const controlsDisabled = loading || emailSync?.progress.active || !!disabledProp

  const selectValue = scopePrefs.mode === 'lookback' ? 'lb' : `fy:${scopePrefs.fiscalYear}`
  const lookbackSelectValue =
    scopePrefs.lookbackDays != null && scopePrefs.lookbackDays >= 1
      ? String(scopePrefs.lookbackDays)
      : 'def'

  /** Stili select nel pannello header (stessa logica della variante pagina default, non supplier). */
  const popRound = 'rounded-lg'
  const popFocus = 'focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/40'
  const popSurface =
    'border border-slate-500/45 bg-slate-800/90 text-slate-100 shadow-md shadow-black/30 backdrop-blur-sm'
  const popSelectBase = `w-full cursor-pointer appearance-none ${popRound} ${popSurface} ${selectSize} transition-colors ${popFocus} disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark]`
  const popChevron = 'pointer-events-none absolute top-1/2 right-2 h-3 w-3 -translate-y-1/2 text-slate-200'

  if (isHeaderPlacement) {
    return (
      <div
        ref={headerWrapRef}
        title={disabledProp && disabledReasonTitle ? disabledReasonTitle : undefined}
        className={['relative shrink-0', classNameProp].filter(Boolean).join(' ')}
      >
        <button
          type="button"
          disabled={controlsDisabled}
          className={`${headerTriggerBtnCls} disabled:cursor-not-allowed disabled:opacity-50`}
          aria-expanded={headerMenuOpen}
          aria-haspopup="dialog"
          aria-controls={headerMenuId}
          onClick={() => setHeaderMenuOpen((o) => !o)}
        >
          <svg className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{t.dashboard.syncEmail}</span>
          <svg
            className={`h-3 w-3 shrink-0 text-cyan-200/90 transition-transform ${headerMenuOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {headerMenuOpen ? (
          <div
            id={headerMenuId}
            role="dialog"
            aria-label={t.dashboard.syncEmail}
            className="absolute right-0 top-[calc(100%+8px)] z-[200] w-[min(calc(100vw-2rem),19rem)] rounded-xl border border-cyan-500/25 bg-slate-900/95 p-3 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.65)] backdrop-blur-md"
          >
            <div className="flex flex-col gap-2.5">
              <div className="relative w-full shrink-0">
                <select
                  value={selectValue}
                  disabled={controlsDisabled}
                  title={t.dashboard.emailSyncScopeHint}
                  aria-label={t.dashboard.emailSyncFiscalYearSelectAria}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === 'lb') {
                      const n: EmailSyncScopePrefs = {
                        mode: 'lookback',
                        fiscalYear: scopePrefs.fiscalYear,
                        lookbackDays: scopePrefs.lookbackDays ?? null,
                        documentKind: scopePrefs.documentKind,
                      }
                      writeEmailSyncScopePrefs(n)
                      setScopePrefs(n)
                      return
                    }
                    const y = Number(v.replace(/^fy:/, ''))
                    if (!Number.isFinite(y)) return
                    const n: EmailSyncScopePrefs = {
                      mode: 'fiscal_year',
                      fiscalYear: y,
                      lookbackDays: scopePrefs.lookbackDays ?? null,
                      documentKind: scopePrefs.documentKind,
                    }
                    writeEmailSyncScopePrefs(n)
                    setScopePrefs(n)
                  }}
                  className={popSelectBase}
                >
                  <option className={selectOptionSurface} value="lb">
                    {t.dashboard.emailSyncScopeLookback}
                  </option>
                  {fiscalYearOptions.map((y) => (
                    <option key={y} className={selectOptionSurface} value={`fy:${y}`}>
                      {t.dashboard.emailSyncScopeFiscal}: {y}
                    </option>
                  ))}
                </select>
                <svg className={popChevron} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {scopePrefs.mode === 'lookback' ? (
                <div className="relative w-full shrink-0">
                  <select
                    value={lookbackSelectValue}
                    disabled={controlsDisabled}
                    title={t.dashboard.emailSyncLookbackDaysHint}
                    aria-label={t.dashboard.emailSyncLookbackDaysAria}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === 'def') {
                        const n: EmailSyncScopePrefs = {
                          ...scopePrefs,
                          lookbackDays: null,
                        }
                        writeEmailSyncScopePrefs(n)
                        setScopePrefs(n)
                        return
                      }
                      const days = Number(v)
                      if (!Number.isFinite(days) || days < 1) return
                      const n: EmailSyncScopePrefs = { ...scopePrefs, lookbackDays: days }
                      writeEmailSyncScopePrefs(n)
                      setScopePrefs(n)
                    }}
                    className={popSelectBase}
                  >
                    <option className={selectOptionSurface} value="def">
                      {t.dashboard.emailSyncLookbackSedeDefault}
                    </option>
                    {LOOKBACK_DAY_PRESETS.map((d) => (
                      <option key={d} className={selectOptionSurface} value={String(d)}>
                        {t.dashboard.emailSyncLookbackDaysN.replace('{n}', String(d))}
                      </option>
                    ))}
                  </select>
                  <svg className={popChevron} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              ) : null}

              {!fornitoreId ? (
                <div className="relative w-full shrink-0">
                  <select
                    value={scopePrefs.documentKind}
                    disabled={controlsDisabled}
                    title={t.dashboard.emailSyncDocumentKindHint}
                    aria-label={t.dashboard.emailSyncDocumentKindAria}
                    onChange={(e) => {
                      const v = e.target.value as EmailSyncDocumentKind
                      if (
                        v !== 'all' &&
                        v !== 'fornitore' &&
                        v !== 'bolla' &&
                        v !== 'fattura' &&
                        v !== 'estratto_conto'
                      ) {
                        return
                      }
                      const n: EmailSyncScopePrefs = { ...scopePrefs, documentKind: v }
                      writeEmailSyncScopePrefs(n)
                      setScopePrefs(n)
                    }}
                    className={popSelectBase}
                  >
                    <option className={selectOptionSurface} value="all">
                      {t.dashboard.emailSyncDocumentKindAll}
                    </option>
                    <option className={selectOptionSurface} value="fornitore">
                      {t.dashboard.emailSyncDocumentKindFornitore}
                    </option>
                    <option className={selectOptionSurface} value="bolla">
                      {t.dashboard.emailSyncDocumentKindBolla}
                    </option>
                    <option className={selectOptionSurface} value="fattura">
                      {t.dashboard.emailSyncDocumentKindFattura}
                    </option>
                    <option className={selectOptionSurface} value="estratto_conto">
                      {t.dashboard.emailSyncDocumentKindEstratto}
                    </option>
                  </select>
                  <svg className={popChevron} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              ) : null}

              <button
                type="button"
                onClick={async () => {
                  await handleClick()
                  setHeaderMenuOpen(false)
                }}
                disabled={controlsDisabled}
                className="mt-1 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/55 bg-cyan-500/30 text-xs font-bold text-cyan-50 shadow-sm shadow-cyan-950/30 transition-colors hover:bg-cyan-500/40 active:bg-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    {t.dashboard.syncing}
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {t.dashboard.syncEmail}
                  </>
                )}
              </button>
            </div>
          </div>
        ) : null}

        {toast ? (
          <p
            className={`mt-1 max-w-[min(calc(100vw-2rem),19rem)] rounded-lg px-2 py-1.5 text-xs font-medium ${
              toast.type === 'ok'
                ? 'bg-emerald-950/50 text-emerald-200'
                : toast.type === 'warn'
                  ? 'bg-amber-950/40 text-amber-100'
                  : 'bg-red-950/50 text-red-200'
            }`}
          >
            {toast.text}
          </p>
        ) : null}
      </div>
    )
  }

  const btnSize = alwaysShowLabel
    ? isSupplierVariant
      ? 'inline-flex min-h-[44px] w-full items-center justify-center gap-1 px-2 py-0 md:h-6 md:min-h-0 md:w-auto md:gap-1 md:px-2 xl:h-9 xl:gap-1.5 xl:px-2.5'
      : 'inline-flex h-10 min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 px-3 py-0 sm:h-9 sm:min-h-0 sm:w-auto sm:px-3.5'
    : 'inline-flex items-center gap-1.5 px-3 py-1.5'
  const selectSizeEffective = isSupplierVariant ? selectSizeSupplier : selectSize
  const fiscalSelectSize = isSupplierVariant ? selectSizeSupplierLookback : selectSize
  const lookbackSelectSize = isSupplierVariant ? selectSizeSupplierLookback : selectSize
  const selectRound = isSupplierVariant ? 'rounded-md' : 'rounded-lg'
  const selectFocusRing = isSupplierVariant
    ? 'focus:ring-1 focus:ring-cyan-500/30'
    : 'focus:ring-2 focus:ring-slate-400/40'
  const selectSurface = isSupplierVariant
    ? 'border-white/10 bg-white/5 text-slate-100 shadow-none shadow-black/0'
    : 'border-slate-500/45 bg-slate-800/85 text-slate-100 shadow-sm shadow-black/25'
  const selectChevronCls = isSupplierVariant ? 'text-slate-300' : 'text-slate-200'
  const selectChevronAbs = isSupplierVariant
    ? 'right-1 h-2 w-2 md:right-1.5 md:h-2.5 md:w-2.5 xl:right-2 xl:h-3 xl:w-3'
    : 'right-2 h-3 w-3'
  const supplierNarrowChevronAbs =
    'right-0.5 h-1.5 w-1.5 md:right-1 md:h-2 md:w-2 xl:right-1.5 xl:h-2.5 xl:w-2.5'
  const narrowRowChevronAbs = isSupplierVariant ? supplierNarrowChevronAbs : selectChevronAbs
  const btnPrimaryCls = isSupplierVariant
    ? `${btnSize} rounded-md border border-cyan-500/40 bg-cyan-500/15 text-[10px] font-bold text-cyan-100 transition-colors hover:bg-cyan-500/25 active:bg-cyan-500/30 whitespace-nowrap touch-manipulation md:text-[11px]`
    : `${btnSize} rounded-lg border border-slate-400/35 bg-slate-200 font-semibold text-xs text-slate-900 shadow-sm transition-colors hover:bg-white active:bg-slate-100 whitespace-nowrap touch-manipulation`

  return (
    <div
      title={disabledProp && disabledReasonTitle ? disabledReasonTitle : undefined}
      className={[
        'flex flex-col',
        isSupplierVariant ? 'gap-1' : 'gap-1.5',
        alwaysShowLabel
          ? isSupplierVariant
            ? 'min-w-0 w-full max-w-full'
            : 'min-w-0 w-full max-w-full md:w-auto md:max-w-none md:shrink-0'
          : 'items-end',
        isSupplierVariant ? 'w-full min-w-0 md:w-auto xl:min-w-0 xl:flex-1 xl:max-w-none' : '',
        classNameProp,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={
          isSupplierVariant
            ? 'flex w-full flex-col gap-1 md:w-auto md:flex-row md:flex-wrap md:items-center md:gap-x-2 md:gap-y-1.5 xl:h-9 xl:w-full xl:flex-nowrap xl:items-center xl:justify-end'
            : alwaysShowLabel
              ? 'flex w-full min-w-0 flex-col gap-2.5 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-2 md:gap-2.5'
              : 'flex flex-wrap items-center justify-end gap-1.5'
        }
      >
      <div
        className={`relative min-w-0 shrink-0 ${
          isSupplierVariant
            ? 'w-full max-w-none md:max-w-[8.75rem]'
            : alwaysShowLabel
              ? 'w-full sm:w-auto sm:max-w-[11rem] md:max-w-[12rem]'
              : 'max-w-[min(100%,12.5rem)]'
        }`}
      >
        <select
          value={selectValue}
          disabled={controlsDisabled}
          title={t.dashboard.emailSyncScopeHint}
          aria-label={t.dashboard.emailSyncFiscalYearSelectAria}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'lb') {
              const n: EmailSyncScopePrefs = {
                mode: 'lookback',
                fiscalYear: scopePrefs.fiscalYear,
                lookbackDays: scopePrefs.lookbackDays ?? null,
                documentKind: scopePrefs.documentKind,
              }
              writeEmailSyncScopePrefs(n)
              setScopePrefs(n)
              return
            }
            const y = Number(v.replace(/^fy:/, ''))
            if (!Number.isFinite(y)) return
            const n: EmailSyncScopePrefs = {
              mode: 'fiscal_year',
              fiscalYear: y,
              lookbackDays: scopePrefs.lookbackDays ?? null,
              documentKind: scopePrefs.documentKind,
            }
            writeEmailSyncScopePrefs(n)
            setScopePrefs(n)
          }}
          className={`w-full cursor-pointer appearance-none border ${selectRound} ${selectSurface} ${fiscalSelectSize} backdrop-blur-sm transition-colors focus:outline-none ${isSupplierVariant ? 'focus:border-cyan-500' : 'focus:border-slate-400'} ${selectFocusRing} disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark]`}
        >
          <option className={selectOptionSurface} value="lb">
            {t.dashboard.emailSyncScopeLookback}
          </option>
          {fiscalYearOptions.map((y) => (
            <option key={y} className={selectOptionSurface} value={`fy:${y}`}>
              {t.dashboard.emailSyncScopeFiscal}: {y}
            </option>
          ))}
        </select>
        <svg
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${narrowRowChevronAbs} ${selectChevronCls}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {scopePrefs.mode === 'lookback' ? (
        <div
          className={`relative min-w-0 shrink-0 ${
            isSupplierVariant
              ? 'w-full max-w-none md:max-w-[7rem]'
              : alwaysShowLabel
                ? 'w-full sm:w-auto sm:max-w-[8.5rem]'
                : 'max-w-[min(100%,11rem)]'
          }`}
        >
          <select
            value={lookbackSelectValue}
            disabled={controlsDisabled}
            title={t.dashboard.emailSyncLookbackDaysHint}
            aria-label={t.dashboard.emailSyncLookbackDaysAria}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'def') {
                const n: EmailSyncScopePrefs = {
                  ...scopePrefs,
                  lookbackDays: null,
                }
                writeEmailSyncScopePrefs(n)
                setScopePrefs(n)
                return
              }
              const days = Number(v)
              if (!Number.isFinite(days) || days < 1) return
              const n: EmailSyncScopePrefs = { ...scopePrefs, lookbackDays: days }
              writeEmailSyncScopePrefs(n)
              setScopePrefs(n)
            }}
            className={`w-full cursor-pointer appearance-none border ${selectRound} ${selectSurface} ${lookbackSelectSize} backdrop-blur-sm transition-colors focus:outline-none ${isSupplierVariant ? 'focus:border-cyan-500' : 'focus:border-slate-400'} ${selectFocusRing} disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark]`}
          >
            <option className={selectOptionSurface} value="def">
              {t.dashboard.emailSyncLookbackSedeDefault}
            </option>
            {LOOKBACK_DAY_PRESETS.map((d) => (
              <option key={d} className={selectOptionSurface} value={String(d)}>
                {t.dashboard.emailSyncLookbackDaysN.replace('{n}', String(d))}
              </option>
            ))}
          </select>
          <svg
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${narrowRowChevronAbs} ${selectChevronCls}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      ) : null}
      {!fornitoreId ? (
        <div
          className={`relative min-w-0 shrink-0 ${
            isSupplierVariant
              ? 'w-full max-w-none md:max-w-[min(100%,13.5rem)]'
              : alwaysShowLabel
                ? 'w-full sm:w-auto sm:max-w-[11rem]'
                : 'max-w-[min(100%,13.5rem)]'
          }`}
        >
          <select
            value={scopePrefs.documentKind}
            disabled={controlsDisabled}
            title={t.dashboard.emailSyncDocumentKindHint}
            aria-label={t.dashboard.emailSyncDocumentKindAria}
            onChange={(e) => {
              const v = e.target.value as EmailSyncDocumentKind
              if (
                v !== 'all' &&
                v !== 'fornitore' &&
                v !== 'bolla' &&
                v !== 'fattura' &&
                v !== 'estratto_conto'
              ) {
                return
              }
              const n: EmailSyncScopePrefs = { ...scopePrefs, documentKind: v }
              writeEmailSyncScopePrefs(n)
              setScopePrefs(n)
            }}
            className={`w-full cursor-pointer appearance-none border ${selectRound} ${selectSurface} ${selectSizeEffective} backdrop-blur-sm transition-colors focus:outline-none ${isSupplierVariant ? 'focus:border-cyan-500' : 'focus:border-slate-400'} ${selectFocusRing} disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark]`}
          >
            <option className={selectOptionSurface} value="all">
              {t.dashboard.emailSyncDocumentKindAll}
            </option>
            <option className={selectOptionSurface} value="fornitore">
              {t.dashboard.emailSyncDocumentKindFornitore}
            </option>
            <option className={selectOptionSurface} value="bolla">
              {t.dashboard.emailSyncDocumentKindBolla}
            </option>
            <option className={selectOptionSurface} value="fattura">
              {t.dashboard.emailSyncDocumentKindFattura}
            </option>
            <option className={selectOptionSurface} value="estratto_conto">
              {t.dashboard.emailSyncDocumentKindEstratto}
            </option>
          </select>
          <svg
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 ${selectChevronAbs} ${selectChevronCls}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      ) : null}
      <button
        onClick={handleClick}
        disabled={controlsDisabled}
        className={`${btnPrimaryCls} disabled:cursor-not-allowed ${isSupplierVariant ? 'disabled:opacity-45' : 'disabled:opacity-50'}`}
      >
        {loading ? (
          <>
            <svg
              className={`shrink-0 animate-spin ${isSupplierVariant ? 'h-4 w-4 md:h-3.5 md:w-3.5 xl:h-4 xl:w-4' : 'h-4 w-4'}`}
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className={labelVis}>{t.dashboard.syncing}</span>
          </>
        ) : (
          <>
            <svg
              className={`shrink-0 ${isSupplierVariant ? 'h-4 w-4 md:h-3.5 md:w-3.5 xl:h-4 xl:w-4' : 'h-4 w-4'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className={labelVis}>{t.dashboard.syncEmail}</span>
          </>
        )}
      </button>
      </div>

      {toast && (
        <p className={`text-xs font-medium px-2 py-1 rounded-lg w-full max-w-full text-right sm:max-w-[220px] ${
          toast.type === 'ok' ? 'bg-slate-700/90 text-green-300' :
          toast.type === 'warn' ? 'bg-slate-700/90 text-amber-200' :
          'bg-slate-700/90 text-red-300'
        }`}>
          {toast.text}
        </p>
      )}
    </div>
  )
}
