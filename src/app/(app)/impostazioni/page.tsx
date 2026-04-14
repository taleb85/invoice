'use client'

import Link from 'next/link'
import { useState, useEffect, useId } from 'react'
import { useRouter } from 'next/navigation'
import { CURRENCIES, TIMEZONES } from '@/lib/translations'
import { useLocale } from '@/lib/locale-context'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsAdminSedeUi, effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'
import { createClient } from '@/utils/supabase/client'
import { clearSessionOperatorGate } from '@/lib/session-operator-gate'
import SedeAddOperatorForm from '@/components/SedeAddOperatorForm'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'

function ProfileMobileHub() {
  const { me } = useMe()
  const { openSwitchModal, activeOperator } = useActiveOperator()
  const router = useRouter()
  const supabase = createClient()
  const { t } = useLocale()

  const masterPlane = effectiveIsMasterAdminPlane(me, activeOperator)
  const showChangeSede = (me?.all_sedi?.length ?? 0) > 1 && masterPlane
  const canManageOperators = !!(
    me?.sede_id &&
    (masterPlane || effectiveIsAdminSedeUi(me, activeOperator))
  )
  const sedeId = me?.sede_id ?? null
  const showOperatorForm = canManageOperators
  const showPickSedeForOperators = masterPlane && !sedeId

  const rowCls =
    'flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-700/40 px-3 py-3 text-sm font-semibold text-slate-100 backdrop-blur-sm transition-colors hover:bg-slate-700/70 active:scale-[0.99]'

  const handleLogout = async () => {
    try {
      localStorage.removeItem('fluxo-active-operator')
      localStorage.removeItem('fluxo-active-operator-user')
    } catch {
      /* ignore */
    }
    clearSessionOperatorGate()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="mb-4 rounded-2xl border border-white/10 bg-slate-700/50 p-3 shadow-lg shadow-black/20 backdrop-blur-md">
      {showOperatorForm && sedeId ? <SedeAddOperatorForm sedeId={sedeId} embedded /> : null}
      {showPickSedeForOperators ? (
        <div className="space-y-2">
          <p className="px-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.sedi.addOperatorSedeTitle}</p>
          <p className="px-0.5 text-xs leading-snug text-slate-200">{t.impostazioni.addOperatorsPickSede}</p>
          <Link href="/sedi" className={rowCls}>
            <svg className="h-4 w-4 shrink-0 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            {t.nav.sediTitle}
          </Link>
        </div>
      ) : null}
      {showOperatorForm || showPickSedeForOperators ? (
        <div className="my-3 border-t border-white/10" aria-hidden />
      ) : null}
      <p className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.impostazioni.accountSection}</p>
      <div className="flex flex-col gap-2">
        {showChangeSede && (
          <Link href="/sedi" className={rowCls}>
            <svg className="h-4 w-4 shrink-0 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            {t.impostazioni.changeSede}
          </Link>
        )}
        <button type="button" onClick={() => openSwitchModal()} className={rowCls}>
          <svg className="h-4 w-4 shrink-0 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          {t.ui.changeOperator}
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className={`${rowCls} border-red-500/25 bg-red-950/20 text-red-200 hover:bg-red-950/40`}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {t.nav.esci}
        </button>
      </div>
    </div>
  )
}

export default function ImpostazioniPage() {
  const { locale, t, currency, setCurrency, timezone, setTimezone } = useLocale()
  const [mounted, setMounted] = useState(false)
  const [saved, setSaved] = useState(false)
  const helpIconGradIdRaw = useId()
  const helpIconGradId = `imp-fluxo-help-${helpIconGradIdRaw.replace(/[^a-zA-Z0-9_-]/g, '') || 'g'}`

  // Local draft state — confirmed on Save
  const [draftCurrency, setDraftCurrency] = useState(currency)
  const [draftTimezone, setDraftTimezone] = useState(timezone)

  useEffect(() => {
    setDraftCurrency(currency)
    setDraftTimezone(timezone)
    setMounted(true)
  }, [currency, timezone])

  const handleSave = () => {
    setCurrency(draftCurrency)
    setTimezone(draftTimezone)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const selectCls =
    'w-full rounded-xl border border-slate-600/60 bg-slate-700/70 px-3.5 py-2.5 text-sm text-slate-100 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40'
  const labelCls = 'mb-1.5 block text-sm font-medium text-slate-200'

  const intlLocale =
    locale === 'it' ? 'it-IT'
    : locale === 'en' ? 'en-GB'
    : locale === 'es' ? 'es-ES'
    : locale === 'fr' ? 'fr-FR'
    : 'de-DE'

  const previewData = mounted
    ? new Intl.DateTimeFormat(intlLocale, { day: '2-digit', month: 'long', year: 'numeric', timeZone: draftTimezone }).format(new Date())
    : '…'
  const previewValuta = mounted
    ? (() => {
        try {
          return new Intl.NumberFormat(intlLocale, { style: 'currency', currency: draftCurrency }).format(1234.56)
        } catch {
          return `${draftCurrency} 1,234.56`
        }
      })()
    : '…'

  const FormBody = () => (
    <div className="space-y-6">
      {/* Currency + Timezone — side by side on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Valuta */}
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
              <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <label className={labelCls + ' mb-0'} suppressHydrationWarning>{t.impostazioni.valuta}</label>
          </div>
          <select value={draftCurrency} onChange={(e) => setDraftCurrency(e.target.value)} className={selectCls}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.symbol} — {c.label} ({c.code})</option>
            ))}
          </select>
        </div>

        {/* Fuso orario */}
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
              <svg className="h-4 w-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <label className={labelCls + ' mb-0'} suppressHydrationWarning>{t.impostazioni.fuso}</label>
          </div>
          <select value={draftTimezone} onChange={(e) => setDraftTimezone(e.target.value)} className={selectCls}>
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Live preview */}
      <div className="rounded-xl border border-slate-700/60 bg-slate-700/40 p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-500" suppressHydrationWarning>{t.impostazioni.preview}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Date</p>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span suppressHydrationWarning>{previewData}</span>
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Currency</p>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <svg className="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span suppressHydrationWarning>{previewValuta}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* ══ MOBILE layout (Help /guida: solo qui, non in MobileTopbar) ══ */}
      <div className="md:hidden p-4 max-w-lg">
        <AppPageHeaderStrip>
          <AppPageHeaderTitleWithDashboardShortcut
            dashboardLabel={t.nav.dashboard}
            className="min-w-0 flex-1 items-start gap-3"
          >
            <h1 className="app-page-title text-xl font-bold" suppressHydrationWarning>
              {mounted ? t.impostazioni.title : ''}
            </h1>
            <p className="mt-1 text-sm text-slate-200" suppressHydrationWarning>
              {mounted ? t.impostazioni.subtitle : ''}
            </p>
          </AppPageHeaderTitleWithDashboardShortcut>
          <div className="flex shrink-0 items-start justify-end">
            <Link
              href="/guida"
              className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-[#1e3a5f] to-[#172554] shadow-md shadow-slate-900/20 transition-all hover:border-cyan-400/35 hover:brightness-110 active:scale-[0.98]"
              aria-label={t.nav.guida}
              title={t.nav.guida}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" aria-hidden>
                <defs>
                  <linearGradient id={helpIconGradId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6b8ef5" />
                    <stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
                <path
                  stroke={`url(#${helpIconGradId})`}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </Link>
          </div>
        </AppPageHeaderStrip>
        <ProfileMobileHub />
        <div className="app-card overflow-hidden">
          <div className="app-card-bar" aria-hidden />
          <div className="space-y-5 p-5">
          <FormBody />
          {saved && (
            <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-300">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              <span suppressHydrationWarning>{t.impostazioni.saved}</span>
            </div>
          )}
          <button onClick={handleSave}
            className="flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 text-sm font-bold text-white transition-colors hover:bg-cyan-600 active:bg-cyan-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            <span suppressHydrationWarning>{t.common.save}</span>
          </button>
          </div>
        </div>
      </div>

      {/* ══ DESKTOP: un’unica colonna (niente seconda sidebar con un solo tab) ══ */}
      <div className="hidden min-h-0 w-full flex-1 flex-col md:flex">
        <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-8 lg:px-8">
          <div className="app-card overflow-hidden">
            <div className="app-card-bar" aria-hidden />
            <div className="border-b border-slate-600/80/80 px-6 py-5 sm:px-8">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15">
                  <svg className="h-5 w-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500" suppressHydrationWarning>
                    {mounted ? t.impostazioni.sectionLocalisation : ''}
                  </p>
                  <h1 className="app-page-title mt-0.5 text-xl font-bold" suppressHydrationWarning>
                    {mounted ? t.impostazioni.title : ''}
                  </h1>
                  <p className="mt-1 text-sm text-slate-200" suppressHydrationWarning>
                    {mounted ? t.impostazioni.subtitle : ''}
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-6 px-6 py-6 sm:px-8">
              <FormBody />
              {saved && (
                <div className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-300">
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span suppressHydrationWarning>{t.impostazioni.saved}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col-reverse gap-3 border-t border-slate-600/80/80 bg-slate-700/40 px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-sm font-bold text-white shadow-[0_0_12px_rgba(6,182,212,0.2)] transition-colors hover:bg-cyan-600 active:bg-cyan-700 sm:w-auto"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span suppressHydrationWarning>{t.common.save}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
