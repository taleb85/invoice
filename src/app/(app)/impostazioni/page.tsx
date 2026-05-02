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
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { BackButton } from '@/components/BackButton'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import ImpostazioniSedeAdminBlocks from '@/components/ImpostazioniSedeAdminBlocks'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'

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
    'flex w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-app-line-25 app-workspace-inset-bg-soft px-3 py-3 text-sm font-semibold text-app-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm transition-colors hover:border-app-a-45 hover:bg-black/12 active:scale-[0.99]'

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
    <div className="app-card overflow-hidden">
      <div className="space-y-3 app-workspace-inset-bg-soft p-3 sm:p-4">
      {showOperatorForm && sedeId ? <SedeAddOperatorForm sedeId={sedeId} embedded /> : null}
      {showPickSedeForOperators ? (
        <div className="space-y-2">
          <p className="px-0.5 text-[10px] font-bold uppercase tracking-wider text-app-fg-muted">{t.sedi.addOperatorSedeTitle}</p>
          <p className="px-0.5 text-xs leading-snug text-app-fg-muted">{t.impostazioni.addOperatorsPickSede}</p>
          <Link href="/sedi" className={rowCls}>
            <svg className="h-4 w-4 shrink-0 text-app-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
        <div className="my-3 border-t border-app-soft-border" aria-hidden />
      ) : null}
      <p className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-wider text-app-fg-muted">{t.impostazioni.accountSection}</p>
      <div className="flex flex-col gap-2">
        {showChangeSede && (
          <Link href="/sedi" className={rowCls}>
            <svg className="h-4 w-4 shrink-0 text-app-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
          className={`${rowCls} border-[rgba(34,211,238,0.15)] bg-red-950/35 text-red-100 hover:border-[rgba(34,211,238,0.15)] hover:bg-red-950/50`}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {t.nav.esci}
        </button>
      </div>
      </div>
    </div>
  )
}

/** Accesso rapido a soglie solleciti (admin / admin sede). */
function SollecitiSettingsLinkCard() {
  const { t } = useLocale()
  const imp = t.impostazioni
  const [drawerOpen, setDrawerOpen] = useState(false)
  const uid = useId()
  const toggleId = `imp-solleciti-toggle-${uid}`
  const panelId = `imp-solleciti-panel-${uid}`

  return (
    <div className="app-card min-h-0 min-w-0 overflow-hidden">
      <div className="app-workspace-inset-bg-soft p-5">
        <button
          type="button"
          id={toggleId}
          aria-expanded={drawerOpen}
          aria-controls={drawerOpen ? panelId : undefined}
          aria-label={drawerOpen ? imp.linkSollecitiDrawerAriaClose : imp.linkSollecitiDrawerAriaOpen}
          onClick={() => setDrawerOpen((v) => !v)}
          className="flex w-full min-w-0 touch-manipulation items-start gap-4 rounded-xl text-left outline-none ring-app-cyan-500/40 transition hover:bg-black/[0.06] focus-visible:ring-2"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 ring-1 ring-amber-500/25">
            <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{imp.linkSolleciti}</p>
            <p className="mt-1 text-xs leading-snug text-app-fg-muted">{imp.linkSollecitiDesc}</p>
            {!drawerOpen ? (
              <p className="mt-1.5 text-xs leading-snug text-app-fg-muted">{imp.linkSollecitiDrawerCollapsedHint}</p>
            ) : null}
          </div>
          <svg
            className={`mt-2 h-5 w-5 shrink-0 text-app-fg-muted transition-transform duration-200 ${drawerOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {drawerOpen ? (
        <div
          id={panelId}
          role="region"
          aria-label={`${imp.linkSolleciti} — ${t.sollecitiSettingsPage.title}`}
          className="border-t border-app-line-30 app-workspace-inset-bg-soft p-5"
        >
          <Link
            href="/settings/solleciti"
            className="flex w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-100 transition-colors hover:border-amber-400/50 hover:bg-amber-500/18 sm:inline-flex sm:w-auto sm:justify-start"
          >
            {t.sollecitiSettingsPage.title} →
          </Link>
        </div>
      ) : null}
    </div>
  )
}

/** Scheda rapida per accedere alla configurazione IMAP della sede effettiva (JWT o contesto PIN/cookie). */
function ImapConfigCard() {
  const { me } = useMe()
  const { t } = useLocale()
  const { effectiveSedeId } = useManualDeliverySede()
  const sedeId = effectiveSedeId ?? me?.sede_id ?? null
  const im = t.impostazioni

  const nameMatchesProfile = !!(sedeId && me?.sede_id?.trim() === sedeId)
  const displayPart =
    nameMatchesProfile && me?.sede_nome?.trim()
      ? me.sede_nome.trim()
      : sedeId
        ? im.imapBranchSessionTitle
        : null

  if (!sedeId) return null

  return (
    <div className="app-card overflow-hidden">
      <div className="flex items-start gap-4 app-workspace-inset-bg-soft p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/12 ring-1 ring-cyan-500/25">
          <svg className="h-5 w-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{im.imapSection ?? 'Email IMAP'}</p>
          <p className="mt-0.5 text-sm font-semibold text-app-fg">
            {displayPart ? `${im.imapBranchSessionTitle}: ${displayPart}` : im.imapSection}
          </p>
          <p className="mt-1 text-xs leading-snug text-app-fg-muted">
            Configura host, porta, utente e password IMAP sulla scheda della sede.
          </p>
          <Link
            href={`/sedi/${sedeId}`}
            className="mt-3 inline-flex touch-manipulation items-center gap-2 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-100 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/18"
          >
            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Impostazioni IMAP sede
          </Link>
        </div>
      </div>
    </div>
  )
}

function NotificationSettings() {
  const { supported, subscribed, loading, subscribe, unsubscribe } = usePushNotifications()

  if (!supported) return null

  return (
    <div className="app-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 app-workspace-inset-bg-soft p-4 sm:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/12 ring-1 ring-cyan-500/25">
            <svg className="h-5 w-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">Notifiche</p>
            <p className="mt-0.5 text-sm font-semibold text-app-fg">Notifiche push</p>
            <p className="mt-1 text-xs leading-snug text-app-fg-muted">
              Ricevi avvisi per nuovi documenti e anomalie prezzi
            </p>
          </div>
        </div>
        <button
          onClick={subscribed ? unsubscribe : subscribe}
          disabled={loading}
          aria-label={subscribed ? 'Disattiva notifiche push' : 'Attiva notifiche push'}
          className={`relative ml-1 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${subscribed ? 'bg-[#22d3ee]' : 'bg-app-line-30'}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${subscribed ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
    </div>
  )
}

export default function ImpostazioniPage() {
  const { locale, t, currency, setCurrency, timezone, setTimezone } = useLocale()
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const [mounted, setMounted] = useState(false)
  const [saved, setSaved] = useState(false)
  const helpIconGradIdRaw = useId()
  const helpIconGradIdBase = `imp-fluxo-help-${helpIconGradIdRaw.replace(/[^a-zA-Z0-9_-]/g, '') || 'g'}`
  const helpIconGradIdMobile = `${helpIconGradIdBase}-m`
  const helpIconGradIdDesktop = `${helpIconGradIdBase}-d`

  const { effectiveSedeId } = useManualDeliverySede()
  const sedeResolved = effectiveSedeId ?? me?.sede_id ?? null

  const masterPlane = effectiveIsMasterAdminPlane(me, activeOperator)
  const isAdminSede = effectiveIsAdminSedeUi(me, activeOperator)
  const isSedePrivileged = masterPlane || isAdminSede
  const showSedePickHint = isSedePrivileged && !sedeResolved
  const showSedeOcrBlocks = isSedePrivileged && !!sedeResolved
  const canEditSolleciti = masterPlane || isAdminSede

  // Local draft state — confirmed on Save
  const [draftCurrency, setDraftCurrency] = useState(currency)
  const [draftTimezone, setDraftTimezone] = useState(timezone)
  const [localisationDrawerOpen, setLocalisationDrawerOpen] = useState(false)
  const localeDrawerUid = useId()
  const locToggleId = `imp-locale-drawer-toggle-${localeDrawerUid}`
  const locRegionId = `imp-locale-drawer-region-${localeDrawerUid}`

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

  const locCurrencyMeta = mounted ? CURRENCIES.find((c) => c.code === draftCurrency) : undefined
  const locTzMeta = mounted ? TIMEZONES.find((z) => z.value === draftTimezone) : undefined
  const locSummaryLine =
    mounted && locCurrencyMeta && locTzMeta
      ? `${locCurrencyMeta.symbol} ${locCurrencyMeta.label} (${locCurrencyMeta.code}) · ${locTzMeta.label}`
      : '…'

  const selectClsInner =
    'w-full rounded-lg border border-app-line-35 bg-black/25 px-3 py-2.5 text-sm text-app-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/20 [color-scheme:dark] focus:border-app-a-55 focus:outline-none focus:ring-2 focus:ring-app-a-35'
  const labelFieldCls = 'mb-2 block text-xs font-medium text-app-fg-muted'

  const LocalisationCardContent = () => (
    <>
      <div className="app-workspace-inset-bg-soft p-5 sm:p-6">
        <button
          type="button"
          id={locToggleId}
          aria-expanded={localisationDrawerOpen}
          aria-controls={localisationDrawerOpen ? locRegionId : undefined}
          aria-label={
            localisationDrawerOpen
              ? t.impostazioni.localisationDrawerAriaClose
              : t.impostazioni.localisationDrawerAriaOpen
          }
          onClick={() => setLocalisationDrawerOpen((open) => !open)}
          className="flex w-full min-w-0 touch-manipulation items-start gap-4 rounded-xl text-left outline-none ring-app-cyan-500/40 transition hover:bg-black/[0.06] focus-visible:ring-2"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/12 ring-1 ring-cyan-500/25">
            <svg className="h-5 w-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3.055 13H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted" suppressHydrationWarning>
              {mounted ? t.impostazioni.sectionLocalisation : ''}
            </p>
            <p className="mt-0.5 text-sm font-semibold leading-snug text-app-fg" suppressHydrationWarning>
              {mounted ? t.impostazioni.subtitle : ''}
            </p>
            <p className="mt-1.5 truncate text-xs text-app-fg-muted sm:whitespace-normal" suppressHydrationWarning>
              {locSummaryLine}
            </p>
            {!localisationDrawerOpen ? (
              <p className="mt-1 text-xs leading-snug text-app-fg-muted">
                {t.impostazioni.localisationDrawerCollapsedHint}
              </p>
            ) : null}
          </div>
          <svg
            className={`mt-2 h-5 w-5 shrink-0 text-app-fg-muted transition-transform duration-200 ${localisationDrawerOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {localisationDrawerOpen ? (
        <div
          id={locRegionId}
          role="region"
          aria-label={mounted ? `${t.impostazioni.subtitle}: ${locSummaryLine}` : undefined}
          className="border-t border-app-line-30"
        >
          <div className="space-y-6 px-5 py-6 sm:px-8">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
          <div className="rounded-xl border border-app-line-28 bg-black/[0.08] p-4 ring-1 ring-white/[0.04] sm:p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/12 ring-1 ring-emerald-500/25">
                <svg className="h-4 w-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <label className={`${labelFieldCls} mb-0 min-w-0 flex-1`} htmlFor="impostazioni-valuta-select" suppressHydrationWarning>
                {t.impostazioni.valuta}
              </label>
            </div>
            <select
              id="impostazioni-valuta-select"
              value={draftCurrency}
              onChange={(e) => setDraftCurrency(e.target.value)}
              className={selectClsInner}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.symbol} — {c.label} ({c.code})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-app-line-28 bg-black/[0.08] p-4 ring-1 ring-white/[0.04] sm:p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/12 ring-1 ring-violet-500/25">
                <svg className="h-4 w-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <label className={`${labelFieldCls} mb-0 min-w-0 flex-1`} htmlFor="impostazioni-fuso-select" suppressHydrationWarning>
                {t.impostazioni.fuso}
              </label>
            </div>
            <select
              id="impostazioni-fuso-select"
              value={draftTimezone}
              onChange={(e) => setDraftTimezone(e.target.value)}
              className={selectClsInner}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-app-line-28 bg-black/[0.06] p-4 ring-1 ring-white/[0.04] sm:p-5">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-app-fg-muted" suppressHydrationWarning>
            {t.impostazioni.preview}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            <div className="min-w-0">
              <p className="mb-1 text-xs font-medium text-app-fg-muted" suppressHydrationWarning>
                {t.impostazioni.fuso}
              </p>
              <div className="flex items-center gap-2 text-sm font-medium text-app-fg">
                <svg className="h-4 w-4 shrink-0 text-violet-400/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span suppressHydrationWarning>{previewData}</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-xs font-medium text-app-fg-muted" suppressHydrationWarning>
                {t.impostazioni.valuta}
              </p>
              <div className="flex items-center gap-2 text-sm font-medium text-app-fg">
                <svg className="h-4 w-4 shrink-0 text-emerald-400/90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span suppressHydrationWarning>{previewValuta}</span>
              </div>
            </div>
          </div>
        </div>
          </div>
        </div>
      ) : null}
    </>
  )

  return (
    <>
      {/* ══ MOBILE layout (Help /guida: solo qui, non in MobileTopbar) ══ */}
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-4 text-app-fg md:hidden">
        <AppPageHeaderStrip
          dense
          flushBottom
          accent="slate"
          leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
          icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
        >
          <AppPageHeaderTitleWithDashboardShortcut className="min-w-0 w-full flex-1 items-center gap-2 sm:gap-3">
            <div className="flex w-full min-w-0 items-center justify-between gap-2">
              <div className="min-w-0 flex-1 pr-1.5">
                <h1
                  className={`${APP_PAGE_HEADER_STRIP_H1_CLASS} truncate`}
                  suppressHydrationWarning
                >
                  {mounted ? t.impostazioni.title : ''}
                </h1>
              </div>
              <Link
                href="/guida"
                className="flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center self-center rounded-lg border border-app-line-35 bg-gradient-to-br from-[rgb(30_41_59/0.95)] via-cyan-950/40 to-indigo-950/90 shadow-md shadow-black/30 ring-1 ring-app-line-15 transition-all hover:border-app-a-55 hover:brightness-110 active:scale-[0.98] sm:h-10 sm:w-10 sm:rounded-xl"
                aria-label={t.nav.guida}
                title={t.nav.guida}
              >
                <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" aria-hidden>
                  <defs>
                    <linearGradient id={helpIconGradIdMobile} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6b8ef5" />
                      <stop offset="100%" stopColor="#22d3ee" />
                    </linearGradient>
                  </defs>
                  <path
                    stroke={`url(#${helpIconGradIdMobile})`}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </Link>
            </div>
          </AppPageHeaderTitleWithDashboardShortcut>
        </AppPageHeaderStrip>
        <div className="app-card overflow-hidden">
          <LocalisationCardContent />
          {saved ? (
            <div className="flex items-center gap-2 border-t border-app-line-30 px-5 py-3.5 text-sm font-semibold text-green-300 app-workspace-inset-bg-soft">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span suppressHydrationWarning>{t.impostazioni.saved}</span>
            </div>
          ) : null}
          <div className="border-t border-app-line-30 app-workspace-inset-bg-soft px-5 py-4">
            <button
              type="button"
              onClick={handleSave}
              className="flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-app-cyan-500 py-3 text-sm font-bold text-white shadow-[0_0_18px_-6px_rgba(34,211,238,0.45)] ring-1 ring-app-tint-300-30 transition-colors hover:bg-app-cyan-400 hover:shadow-[0_0_22px_-5px_rgba(34,211,238,0.55)] active:bg-cyan-600"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span suppressHydrationWarning>{t.common.save}</span>
            </button>
          </div>
        </div>
        <ImapConfigCard />
        {canEditSolleciti ? <SollecitiSettingsLinkCard /> : null}
        <NotificationSettings />
        {showSedePickHint ? (
          <div className="app-card overflow-hidden border border-amber-500/30 bg-amber-500/[0.07]">
            <div className="app-workspace-inset-bg-soft p-5">
              <p className="text-xs leading-relaxed text-amber-100/95">{t.impostazioni.sedeScopedAdminHint}</p>
              <Link
                href="/sedi"
                className="mt-3 inline-flex touch-manipulation items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/14 px-3.5 py-2 text-xs font-semibold text-amber-50 transition-colors hover:bg-amber-500/22"
              >
                {t.nav.sediNavGroupMaster ?? t.nav.sediTitle}
              </Link>
            </div>
          </div>
        ) : null}
        {showSedeOcrBlocks && sedeResolved ? <ImpostazioniSedeAdminBlocks sedeId={sedeResolved} /> : null}
        <ProfileMobileHub />
      </div>

      {/* ══ DESKTOP: stessa strip del mobile (back + icona + tray) senza header duplicato in card ══ */}
      <div className={`hidden min-h-0 w-full flex-1 flex-col md:flex ${APP_SHELL_SECTION_PAGE_STACK_CLASS}`}>
        <div className="mx-auto flex min-h-0 min-w-0 w-full max-w-[var(--app-layout-max-width)] flex-1 flex-col">
          <AppPageHeaderStrip
            dense
            flushBottom
            accent="slate"
            leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
          >
            <AppPageHeaderTitleWithDashboardShortcut className="min-w-0 w-full flex-1 items-center gap-2 sm:gap-3">
              <div className="flex w-full min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted" suppressHydrationWarning>
                    {mounted ? t.impostazioni.sectionLocalisation : ''}
                  </p>
                  <h1 className={`${APP_PAGE_HEADER_STRIP_H1_CLASS} mt-0.5`} suppressHydrationWarning>
                    {mounted ? t.impostazioni.title : ''}
                  </h1>
                </div>
                <Link
                  href="/guida"
                  className="flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center self-start rounded-lg border border-app-line-35 bg-gradient-to-br from-[rgb(30_41_59/0.95)] via-cyan-950/40 to-indigo-950/90 shadow-md shadow-black/30 ring-1 ring-app-line-15 transition-all hover:border-app-a-55 hover:brightness-110 active:scale-[0.98] sm:h-10 sm:w-10 sm:rounded-xl sm:self-center"
                  aria-label={t.nav.guida}
                  title={t.nav.guida}
                >
                  <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" aria-hidden>
                    <defs>
                      <linearGradient id={helpIconGradIdDesktop} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6b8ef5" />
                        <stop offset="100%" stopColor="#22d3ee" />
                      </linearGradient>
                    </defs>
                    <path
                      stroke={`url(#${helpIconGradIdDesktop})`}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </Link>
              </div>
            </AppPageHeaderTitleWithDashboardShortcut>
          </AppPageHeaderStrip>
          <div className="mt-3 flex min-h-0 min-w-0 w-full flex-1 flex-col gap-10">
            <div
              className={
                showSedeOcrBlocks && sedeResolved
                  ? 'grid min-h-0 w-full grid-cols-1 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-x-8 xl:gap-x-10'
                  : 'min-h-0 w-full'
              }
            >
              <div className="flex min-h-0 min-w-0 flex-col gap-10">
                <div className="min-h-0 min-w-0">
                  <div className="app-card overflow-hidden">
                    <LocalisationCardContent />
                    {saved ? (
                      <div className="flex items-center gap-2 border-t border-app-line-30 px-6 py-3.5 text-sm font-semibold text-green-300 app-workspace-inset-bg-soft sm:px-8">
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span suppressHydrationWarning>{t.impostazioni.saved}</span>
                      </div>
                    ) : null}
                    <div className="flex flex-col-reverse gap-3 border-t border-app-line-30 app-workspace-inset-bg-soft px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
                      <button
                        type="button"
                        onClick={handleSave}
                        className="inline-flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-app-cyan-500 px-6 py-3 text-sm font-bold text-white shadow-[0_0_12px_rgba(6,182,212,0.2)] transition-colors hover:bg-cyan-600 active:bg-cyan-700 sm:w-auto"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span suppressHydrationWarning>{t.common.save}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 min-w-0 flex-col gap-4">
                  <ImapConfigCard />
                  {canEditSolleciti ? <SollecitiSettingsLinkCard /> : null}
                  <NotificationSettings />
                  {showSedePickHint ? (
                    <div className="app-card overflow-hidden border border-amber-500/30 bg-amber-500/[0.07]">
                      <div className="app-workspace-inset-bg-soft p-5">
                        <p className="text-xs leading-relaxed text-amber-100/95">{t.impostazioni.sedeScopedAdminHint}</p>
                        <Link
                          href="/sedi"
                          className="mt-3 inline-flex touch-manipulation items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/14 px-3.5 py-2 text-xs font-semibold text-amber-50 transition-colors hover:bg-amber-500/22"
                        >
                          {t.nav.sediNavGroupMaster ?? t.nav.sediTitle}
                        </Link>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {showSedeOcrBlocks && sedeResolved ? (
                <section
                  className="min-h-0 min-w-0"
                  aria-label={t.impostazioni.sedeDocsGroupingEyebrow}
                >
                  <ImpostazioniSedeAdminBlocks sedeId={sedeResolved} />
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
