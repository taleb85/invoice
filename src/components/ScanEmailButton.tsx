'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
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
  /** Se true mostra sempre il testo (non solo su desktop) */
  alwaysShowLabel?: boolean
  /**
   * When provided (e.g. from /sedi/[sede_id]/page.tsx URL params), the scan is
   * scoped to this specific branch — skips the /api/me lookup entirely.
   */
  sedeId?: string
}

export default function ScanEmailButton({ alwaysShowLabel = false, sedeId: propSedeId }: Props) {
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'warn' | 'error'; text: string } | null>(null)
  const [scopePrefs, setScopePrefs] = useState<EmailSyncScopePrefs>(() => readEmailSyncScopePrefs())
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

  const labelVis = alwaysShowLabel ? '' : 'hidden md:inline'
  const btnSize = alwaysShowLabel
    ? 'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 px-3 py-0'
    : 'inline-flex items-center gap-1.5 px-3 py-1.5'
  const selectSize =
    'h-8 py-0 pl-2 pr-7 text-left text-[11px] font-medium leading-8'

  const selectValue = scopePrefs.mode === 'lookback' ? 'lb' : `fy:${scopePrefs.fiscalYear}`
  const lookbackSelectValue =
    scopePrefs.lookbackDays != null && scopePrefs.lookbackDays >= 1
      ? String(scopePrefs.lookbackDays)
      : 'def'

  return (
    <div className={`flex flex-col gap-1.5 ${alwaysShowLabel ? 'min-w-0 shrink-0' : 'items-end'}`}>
      <div
        className={`flex flex-wrap items-center gap-1.5 ${alwaysShowLabel ? '' : 'justify-end'}`}
      >
      <div className="relative max-w-[min(100%,12.5rem)] min-w-0 shrink-0">
        <select
          value={selectValue}
          disabled={loading || emailSync?.progress.active}
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
          className={`w-full cursor-pointer appearance-none rounded-lg border border-slate-600/50 bg-slate-700/90 ${selectSize} text-slate-100 shadow-sm shadow-black/20 backdrop-blur-sm transition-colors focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark]`}
        >
          <option className="bg-slate-700 text-slate-100" value="lb">
            {t.dashboard.emailSyncScopeLookback}
          </option>
          {fiscalYearOptions.map((y) => (
            <option key={y} className="bg-slate-700 text-slate-100" value={`fy:${y}`}>
              {t.dashboard.emailSyncScopeFiscal}: {y}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {scopePrefs.mode === 'lookback' ? (
        <div className="relative max-w-[min(100%,11rem)] min-w-0 shrink-0">
          <select
            value={lookbackSelectValue}
            disabled={loading || emailSync?.progress.active}
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
            className={`w-full cursor-pointer appearance-none rounded-lg border border-slate-600/50 bg-slate-700/90 ${selectSize} text-slate-100 shadow-sm shadow-black/20 backdrop-blur-sm transition-colors focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark]`}
          >
            <option className="bg-slate-700 text-slate-100" value="def">
              {t.dashboard.emailSyncLookbackSedeDefault}
            </option>
            {LOOKBACK_DAY_PRESETS.map((d) => (
              <option key={d} className="bg-slate-700 text-slate-100" value={String(d)}>
                {t.dashboard.emailSyncLookbackDaysN.replace('{n}', String(d))}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-200"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      ) : null}
      <div className="relative max-w-[min(100%,13.5rem)] min-w-0 shrink-0">
        <select
          value={scopePrefs.documentKind}
          disabled={loading || emailSync?.progress.active}
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
          className={`w-full cursor-pointer appearance-none rounded-lg border border-slate-600/50 bg-slate-700/90 ${selectSize} text-slate-100 shadow-sm shadow-black/20 backdrop-blur-sm transition-colors focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:dark]`}
        >
          <option className="bg-slate-700 text-slate-100" value="all">
            {t.dashboard.emailSyncDocumentKindAll}
          </option>
          <option className="bg-slate-700 text-slate-100" value="fornitore">
            {t.dashboard.emailSyncDocumentKindFornitore}
          </option>
          <option className="bg-slate-700 text-slate-100" value="bolla">
            {t.dashboard.emailSyncDocumentKindBolla}
          </option>
          <option className="bg-slate-700 text-slate-100" value="fattura">
            {t.dashboard.emailSyncDocumentKindFattura}
          </option>
          <option className="bg-slate-700 text-slate-100" value="estratto_conto">
            {t.dashboard.emailSyncDocumentKindEstratto}
          </option>
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-200"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      <button
        onClick={handleClick}
        disabled={loading || emailSync?.progress.active}
        className={`${btnSize} rounded-lg bg-cyan-500 font-semibold text-xs text-white transition-colors hover:bg-cyan-600 active:bg-cyan-700 disabled:opacity-50 whitespace-nowrap touch-manipulation`}
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className={labelVis}>{t.dashboard.syncing}</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className={labelVis}>{t.dashboard.syncEmail}</span>
          </>
        )}
      </button>
      </div>

      {toast && (
        <p className={`text-xs font-medium px-2 py-1 rounded-lg max-w-[220px] text-right ${
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
