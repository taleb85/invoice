'use client'

import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { usePathname, useRouter } from 'next/navigation'
import { SplashScreen } from './splash-screen'
import { UserProvider, useMe, type MeData } from '@/lib/me-context'
import { LocaleProvider, useLocale } from '@/lib/locale-context'
import {
  ActiveOperatorProvider,
  useActiveOperator,
  FLUXO_ACTIVE_OPERATOR_KEY,
  FLUXO_ACTIVE_OPERATOR_USER_KEY,
} from '@/lib/active-operator-context'
import { effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'
import {
  ToastProvider,
  useToast,
  desktopHeaderBarSurfaceClass,
  useDesktopHeaderToastBanner,
  type DesktopHeaderToastBanner,
} from '@/lib/toast-context'
import { localeFromCountryCode, type Locale } from '@/lib/translations'
import DashboardMobileBottomNav from './DashboardMobileBottomNav'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import { AppActivitiesProvider } from '@/lib/app-activities-context'
import { DocumentActionsProvider } from '@/lib/document-actions-context'
import type { DocumentActionItem } from '@/components/DocumentActionsModal'
import { openDocumentUrl } from '@/lib/open-document-url'
import type { DocumentActionResult } from '@/lib/document-action-result'
import { STATEMENTS_LAYOUT_REFRESH_EVENT } from '@/lib/statements-layout-refresh'
import { translateDocumentiDaProcessareError } from '@/lib/documenti-da-processare-errors'
import { EmailSyncProgressProvider } from './EmailSyncProgressProvider'
import EmailSyncProgressBar from './EmailSyncProgressBar'
import { isFornitoreProfileRoute, normalizeAppPath, showsMobileBottomBar } from '@/lib/mobile-hub-routes'
import { useManualDeliverySede } from '@/lib/use-effective-sede-id'
import { NetworkProvider } from '@/lib/network-context'
import NavigationTopProgress, {
  APP_DESKTOP_HEADER_NAV_PROGRESS_ANCHOR_ID,
  APP_DESKTOP_SIDEBAR_NAV_PROGRESS_ANCHOR_ID,
} from '@/components/NavigationTopProgress'
import { SidebarRailBrand } from '@/components/SidebarBrandHeader'
import BranchSessionGate from '@/components/BranchSessionGate'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { DeepAuroraIntegration } from '@/components/deep-aurora/DeepAuroraIntegration'
import { AppMainScrollRestoration } from '@/lib/return-navigation-client'
import { ContextMenuProvider } from '@/components/ui/ContextMenuProvider'
import AdminSedeViewBanner from '@/components/AdminSedeViewBanner'

const SidebarController = dynamic(() => import('./SidebarController'), { ssr: false })
const Sidebar = dynamic(() => import('./Sidebar'), { ssr: false })
const OperatorSwitchModal = dynamic(() => import('./OperatorSwitchModal'), { ssr: false })
const OfflineBanner = dynamic(() => import('./offline/offline-banner'), { ssr: false })
const UpdatePrompt = dynamic(() => import('./update-prompt'), { ssr: false })

/**
 * Syncs locale, currency and timezone from the active sede when the user
 * has no explicit cookie preference (first session or sede change).
 */
function LocaleSyncFromSede() {
  const { me } = useMe()
  const { setLocale, setCurrency, setTimezone } = useLocale()

  useEffect(() => {
    if (!me) return

    const cookieVal = (name: string) => {
      if (typeof document === 'undefined') return ''
      const m = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'))
      return m ? decodeURIComponent(m[1]) : ''
    }

    // UI language: only auto-set from sede if the user has NEVER chosen
    // a language explicitly (no cookie). A manual choice from the sidebar
    // or Settings always takes priority and is never overridden here.
    if (me.country_code && !cookieVal('app-locale')) {
      setLocale(localeFromCountryCode(me.country_code) as Locale)
    }

    // Currency: sync from sede only if no user override
    if (me.currency && !cookieVal('app-currency')) {
      setCurrency(me.currency)
    }

    // Timezone: sync from sede only if no user override
    if (me.timezone && !cookieVal('app-timezone')) {
      setTimezone(me.timezone)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.country_code, me?.currency, me?.timezone])

  return null
}

function readBrowserCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return m ? decodeURIComponent(m[1]) : ''
}

/**
 * Redirect master admin to /onboarding when no sedi are configured yet.
 * La home `/` è sempre raggiungibile: è il “Portale Gestionale” (griglia vuota / CTA creazione sedi),
 * mentre le altre rotte continuano fino al completamento onboarding.
 */
function onboardingIncompleteMasterMayStay(pathname: string | null | undefined): boolean {
  const p = pathname ?? ''
  if (p === '/' || p === '') return true
  if (p === '/consumi-ai' || p.startsWith('/consumi-ai/')) return true
  if (p === '/log' || p.startsWith('/log/')) return true
  if (p === '/sedi' || p.startsWith('/sedi/')) return true
  return false
}

function OnboardingGuard() {
  const { me } = useMe()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!me) return
    if (!me.is_admin) return
    if (me.onboarding_complete) return
    if (pathname?.startsWith('/onboarding')) return
    if (onboardingIncompleteMasterMayStay(pathname)) return
    router.replace('/onboarding')
  }, [me, pathname, router])

  return null
}

/**
 * Dopo il PIN operatore, `fluxo-acting-role` e `admin-sede-id` devono restare allineati
 * a `activeOperator` (persistito in localStorage). Se il cookie acting viene azzerato
 * (es. cambio sede) ma l’operatore resta in memoria, il server mostra il banner cyan
 * mentre la UI è ancora “da operatore”.
 */
function AdminActingRoleCookieSync() {
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const router = useRouter()

  useEffect(() => {
    if (!me?.is_admin || !activeOperator?.sede_id) return
    if (readBrowserCookie('fluxo-acting-role')) return
    const ar =
      activeOperator.role === 'admin_sede'
        ? 'admin_sede'
        : 'operatore'
    document.cookie = `admin-sede-id=${encodeURIComponent(activeOperator.sede_id)}; path=/; SameSite=Strict`
    document.cookie = `fluxo-acting-role=${encodeURIComponent(ar)}; path=/; SameSite=Strict`
    router.refresh()
  }, [me?.is_admin, activeOperator?.id, activeOperator?.sede_id, activeOperator?.role, router])

  return null
}

/**
 * L’operatore in localStorage è valido solo per l’account che ha inserito il PIN.
 * Senza questo, un nuovo login (es. Gustavo) mostrerebbe ancora TALEB dal browser precedente.
 */
function ActiveOperatorSessionReconcile() {
  const { me } = useMe()
  const { clearActiveOperator } = useActiveOperator()

  useEffect(() => {
    const uid = me?.user?.id?.trim()
    if (!uid) return
    try {
      const raw = localStorage.getItem(FLUXO_ACTIVE_OPERATOR_KEY)
      const bound = localStorage.getItem(FLUXO_ACTIVE_OPERATOR_USER_KEY)
      if (!raw) {
        if (bound) localStorage.removeItem(FLUXO_ACTIVE_OPERATOR_USER_KEY)
        return
      }
      if (!bound || bound !== uid) {
        clearActiveOperator()
      }
    } catch {
      /* ignore */
    }
  }, [me?.user?.id, clearActiveOperator])

  return null
}

export default function AppShell({
  children,
  initialLocale,
  initialMe,
}: {
  children: React.ReactNode
  initialLocale?: string
  initialMe?: MeData | null
}) {
  return (
    <LocaleProvider initialLocale={initialLocale}>
      <UserProvider initialMe={initialMe}>
        <NetworkProvider>
        <LocaleSyncFromSede />
          <ActiveOperatorProvider>
          <OnboardingGuard />
          <ActiveOperatorSessionReconcile />
          <AdminActingRoleCookieSync />
          <ToastProvider>
            <AppShellDocumentActions>
              <AppShellRootBoundary>
                <div className="relative flex w-full min-h-dvh flex-col bg-transparent md:h-full md:min-h-0">
                  <OfflineBanner />
                  <EmailSyncProgressProvider>
                    <AppActivitiesProvider>
                      <ContextMenuProvider>
                        <AppShellMain>{children}</AppShellMain>
                      </ContextMenuProvider>
                    </AppActivitiesProvider>
                  </EmailSyncProgressProvider>
                  <DashboardMobileBottomNav />
                  <OperatorSwitchModal />
                  <UpdatePrompt />
                </div>
              </AppShellRootBoundary>
            </AppShellDocumentActions>
          </ToastProvider>
        </ActiveOperatorProvider>
        </NetworkProvider>
      </UserProvider>
    </LocaleProvider>
  )
}

/** Wrapper functional che traduce il sectionName "applicazione" usando useT. */
function AppShellRootBoundary({ children }: { children: React.ReactNode }) {
  const { t } = useLocale()
  return (
    <ErrorBoundary fullPage sectionName={t.errorBoundary.sectionAppName}>
      {children}
    </ErrorBoundary>
  )
}

/** Componente interno che ha accesso a useToast e DocumentActionsProvider. */
function AppShellDocumentActions({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast()
  const { t } = useLocale()
  const { me } = useMe()
  const handleDocumentAction = useCallback(async (item: DocumentActionItem, actionId: string): Promise<DocumentActionResult> => {
    const a = t.appShellActions
    const httpErr = (status: number) => t.common.httpError.replace('{code}', String(status))
    const succeed = (message?: string): DocumentActionResult => {
      if (message) showToast(message, 'success')
      return { ok: true }
    }
    const inform = (message: string): DocumentActionResult => {
      showToast(message, 'info')
      return { ok: false, error: message, informational: true }
    }
    const fail = (message: string): DocumentActionResult => {
      showToast(message, 'error')
      return { ok: false, error: message }
    }
    // Azioni che richiedono un dialogo (disponibili solo nel Centro Controllo)
    const dialogOnly: Record<string, string> = {
      'documento.associa': a.centroControlloAssociaFornitore,
      'fattura.rifiuta': a.centroControlloRifiutaFattura,
      'statement.assegna_fattura': a.centroControlloAssegnaFattura,
      'statement.associa_fornitore': a.centroControlloAssociaFornitore,
    }
    const dialogMsg = dialogOnly[actionId]
    if (dialogMsg) {
      return inform(dialogMsg)
    }

    // Apri documento
    if (actionId === 'documento.apri') {
      const jsonHref =
        item.origine === 'bolla' || item.origine === 'bolla_aperta'
          ? openDocumentUrl({ bollaId: item.id, json: true })
          : item.origine === 'fattura'
            ? openDocumentUrl({ fatturaId: item.id, json: true })
            : item.origine === 'riga_statement' || item.origine === 'statement'
              ? openDocumentUrl({ statementId: item.id, json: true })
              : openDocumentUrl({ documentoId: item.id, json: true })
      const res = await fetch(jsonHref)
      if (!res.ok) return fail(httpErr(res.status))
      const { url: docUrl } = await res.json()
      if (docUrl) window.open(docUrl, '_blank')
      return succeed()
    }

    const isBollaOrigine = item.origine === 'bolla' || item.origine === 'bolla_aperta'
    if (isBollaOrigine && actionId === 'documento.finalizza_come_fattura') {
      const res = await fetch('/api/bolle/convert-to-fattura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bolla_id: item.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return fail((data as { error?: string }).error || httpErr(res.status))
      }
      window.dispatchEvent(new CustomEvent('bolla-mutated', { detail: { id: item.id } }))
      return succeed(a.bollaConvertita)
    }

    const apiCalls: Record<string, { url: string; body: Record<string, unknown> }> = {
      'documento.scarta': { url: '/api/documenti-da-processare', body: { id: item.id, azione: 'scarta' } },
      'documento.finalizza_come_fattura': { url: '/api/documenti-da-processare', body: { id: item.id, azione: 'finalizza_tipo', kind: 'fattura' } },
      'documento.finalizza_come_bolla': { url: '/api/documenti-da-processare', body: { id: item.id, azione: 'finalizza_tipo', kind: 'bolla' } },
      'documento.finalizza_come_nota_credito': { url: '/api/documenti-da-processare', body: { id: item.id, azione: 'finalizza_tipo', kind: 'nota_credito' } },
      'documento.finalizza_come_statement': { url: '/api/documenti-da-processare', body: { id: item.id, azione: 'finalizza_tipo', kind: 'statement' } },
      'documento.finalizza_come_ordine': { url: '/api/documenti-da-processare', body: { id: item.id, azione: 'finalizza_tipo', kind: 'ordine' } },
      'documento.finalizza_come_comunicazione': { url: '/api/documenti-da-processare', body: { id: item.id, azione: 'finalizza_tipo', kind: 'comunicazione' } },
      'documento.finalizza_come_listino': { url: '/api/documenti-da-processare', body: { id: item.id, azione: 'finalizza_tipo', kind: 'listino' } },
      'documento.rianalizza_ocr': { url: '/api/documenti-da-processare', body: { id: item.id, azione: 'rianalizza_ocr' } },
      'documento.ignora_mittente': { url: '/api/documenti-da-processare', body: { id: item.id, azione: 'ignora_mittente' } },
      'fattura.approva': { url: '/api/fatture/approve', body: { fattura_id: item.id, action: 'approve' } },
      'statement.segna_come_ok': { url: '/api/statements/update-row-status', body: { rowId: item.id, status: 'ok' } },
    }
    // Scarta fattura → chiama l'API di rifiuto
    if (actionId === 'documento.scarta_fattura') {
      const res = await fetch('/api/fatture/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fattura_id: item.id, action: 'reject', reason: a.rejectReason }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return fail(data.error || httpErr(res.status))
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('document-type-changed', { detail: { id: item.id } }))
      }
      return succeed(a.fatturaScartata)
    }
    // Per documenti già registrati (fatture, bolle), i finalizza_come_* aggiornano il tipo direttamente
    // invece di creare un nuovo documento dalla coda.
    const registeredReclassify: Record<string, { url: string; body: Record<string, unknown> }> = {
      'documento.finalizza_come_nota_credito': { url: '/api/fatture/update-type', body: { id: item.id, is_credit_note: true } },
      'documento.finalizza_come_fattura': { url: '/api/fatture/update-type', body: { id: item.id, is_credit_note: false } },
    }
    const isRegistered =
      item.origine === 'fattura' || item.origine === 'bolla' || item.origine === 'bolla_aperta'
    const reclass = isRegistered && registeredReclassify[actionId]
    if (reclass) {
      const res = await fetch(reclass.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reclass.body) })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return fail(data.error || httpErr(res.status))
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('document-type-changed', { detail: { id: item.id } }))
      }
      return succeed(a.tipoDocumentoAggiornato)
    }
    // Bolla: cambia fornitore richiede picker UI nel pannello bolla
    if (actionId === 'bolla.cambia_fornitore') {
      return inform(a.aprilPannelloBolla)
    }

    // Bolla: azioni che chiamano API dirette + notificano il tab di ricaricare
    if (actionId === 'bolla.rianalizza_ocr') {
      const res = await fetch('/api/admin/fix-ocr-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bolla_id: item.id,
          limit: 1,
          allow_tipo_migrate: true,
          ...(item.sede_id ? { sede_id: item.sede_id } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return fail((data as { error?: string }).error || httpErr(res.status))
      }
      window.dispatchEvent(new CustomEvent('bolla-mutated', { detail: { id: item.id } }))
      return succeed(a.ocrCompletato)
    }
    if (actionId === 'bolla.converti_in_fattura') {
      const res = await fetch('/api/bolle/convert-to-fattura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bolla_id: item.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return fail((data as { error?: string }).error || httpErr(res.status))
      }
      window.dispatchEvent(new CustomEvent('bolla-mutated', { detail: { id: item.id } }))
      return succeed(a.bollaConvertita)
    }
    if (actionId === 'statement.converti_in_fattura') {
      if (!me?.is_admin && !me?.is_admin_sede) {
        return fail(a.azioneNonDisponibile.replace('{action}', actionId))
      }
      const res = await fetch('/api/statements/convert-to-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ statement_id: item.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        return fail((data as { error?: string }).error || httpErr(res.status))
      }
      window.dispatchEvent(new Event(STATEMENTS_LAYOUT_REFRESH_EVENT))
      return succeed(t.bolle.convertiInFatturaOk ?? a.bollaConvertita)
    }
    if (actionId === 'bolla.elimina') {
      const supabase = (await import('@/utils/supabase/client')).createClient()
      const { error: delErr } = await supabase.from('bolle').delete().eq('id', item.id)
      if (delErr) {
        return fail(delErr.message)
      }
      window.dispatchEvent(new CustomEvent('bolla-mutated', { detail: { id: item.id } }))
      return succeed(a.bollaEliminata)
    }

    const api = apiCalls[actionId]
    if (!api) {
      return inform(a.azioneNonDisponibile.replace('{action}', actionId))
    }
    const res = await fetch(api.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(api.body) })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      return fail(
        translateDocumentiDaProcessareError(data.error, t) || data.error || httpErr(res.status),
      )
    }
    if (typeof window !== 'undefined') {
      if (actionId.startsWith('documento.') && item.origine === 'documento_da_processare') {
        window.dispatchEvent(new Event(STATEMENTS_LAYOUT_REFRESH_EVENT))
      } else if (actionId.startsWith('fattura.') || actionId === 'statement.segna_come_ok') {
        window.dispatchEvent(new CustomEvent('fattura-mutated', { detail: { id: item.id } }))
      }
    }
    return succeed(a.operazioneCompletata)
  }, [showToast, t, me?.is_admin, me?.is_admin_sede])

  return (
    <DocumentActionsProvider onExecute={handleDocumentAction}>
      {children}
    </DocumentActionsProvider>
  )
}

function desktopToastBannerTextClass(
  banner: ReturnType<typeof useDesktopHeaderToastBanner>
): string {
  if (!banner) return ''
  if (banner.type === 'success') return 'text-emerald-50'
  if (banner.type === 'error') return 'text-red-50'
  return 'text-app-fg'
}

const HEADER_TOAST_ABOVE_GAP_PX = 10
/** Allineato a `toast-context` breakpoint desktop bar / toast floating. */
const MD_MIN_PX = 768

/** Host header desktop: cercato via id così il portale non dipende dallo state del ref (ordine JSX). */
function getDesktopNavProgressHost(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.getElementById(APP_DESKTOP_HEADER_NAV_PROGRESS_ANCHOR_ID)
}

/**
 * Rettangolo per il toast desktop (`md+`): strip `#app-desktop-header-nav-progress` se ha altezza (tablet),
 * altrimenti bordo superiore di `#app-main` (lg+ senza riga hamburger).
 */
function getDesktopHeaderToastMeasureEl(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const header = getDesktopNavProgressHost()
  if (header) {
    const r = header.getBoundingClientRect()
    if (r.height >= 1 && r.width >= 1) return header
  }
  return document.getElementById('app-main')
}

/**
 * Toast desktop (`md+`): sopra la strip `#app-desktop-header-nav-progress` (tablet) o sopra `#app-main` (lg+ strip collassata).
 * Portale `fixed` in `document.body`; la toolbar non si sposta.
 */
function DesktopHeaderBannerPortal({ banner }: { banner: DesktopHeaderToastBanner }) {
  const measureElRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const headerNavBarSurface = banner ? desktopHeaderBarSurfaceClass(banner) : ''
  const headerBannerTextCls = desktopToastBannerTextClass(banner)

  useLayoutEffect(() => {
    if (banner === null) {
      setPos(null)
      return
    }

    const mq = window.matchMedia(`(min-width: ${MD_MIN_PX}px)`)

    const sync = () => {
      if (!mq.matches) {
        setPos(null)
        return
      }

      const anchorEl = getDesktopHeaderToastMeasureEl()
      if (!anchorEl) {
        setPos(null)
        return
      }

      const r = anchorEl.getBoundingClientRect()
      if (r.height < 1 || r.width < 1) {
        setPos(null)
        return
      }

      const h = measureElRef.current?.offsetHeight ?? 76
      const rawTop = r.top - h - HEADER_TOAST_ABOVE_GAP_PX
      const padParsed = Number.parseFloat(getComputedStyle(document.documentElement).paddingTop) || 0
      const minTop = Math.max(12, padParsed + 4)

      const top = Math.max(minTop, rawTop)

      setPos({
        top,
        left: r.left + r.width / 2,
        width: Math.min(Math.max(r.width - 32, 220), 672),
      })
    }

    const onMq = () => sync()
    mq.addEventListener('change', onMq)

    let roAnchor: ResizeObserver | undefined
    const headerHost = getDesktopNavProgressHost()
    const mainEl = typeof document !== 'undefined' ? document.getElementById('app-main') : null
    if (headerHost || mainEl) {
      roAnchor = new ResizeObserver(sync)
      if (headerHost) roAnchor.observe(headerHost)
      if (mainEl) roAnchor.observe(mainEl)
    }

    let roInner: ResizeObserver | undefined

    const attachInnerRo = () => {
      const el = measureElRef.current
      if (!el || roInner) return
      roInner = new ResizeObserver(sync)
      roInner.observe(el)
    }

    sync()
    attachInnerRo()

    const rafId =
      typeof requestAnimationFrame !== 'undefined'
        ? requestAnimationFrame(() => {
            sync()
            attachInnerRo()
          })
        : undefined

    window.addEventListener('resize', sync)
    window.addEventListener('scroll', sync, true)

    return () => {
      mq.removeEventListener('change', onMq)
      roAnchor?.disconnect()
      roInner?.disconnect()
      if (rafId !== undefined) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', sync)
      window.removeEventListener('scroll', sync, true)
    }
  }, [banner])

  if (banner === null) {
    return null
  }

  return createPortal(
    <div
      className="pointer-events-none fixed z-[10050] flex justify-center transition-opacity duration-150"
      style={
        pos
          ? {
              top: pos.top,
              left: pos.left,
              width: pos.width,
              transform: 'translateX(-50%)',
              opacity: 1,
            }
          : {
              top: 0,
              left: '50%',
              width: 672,
              transform: 'translateX(-50%)',
              opacity: 0,
            }
      }
      aria-hidden={!pos}
      role="presentation"
    >
      <div
        ref={measureElRef}
        role="status"
        aria-live="polite"
        className={[
          'pointer-events-auto max-h-[5.75rem] w-full rounded-2xl border border-white/[0.14] px-4 py-2 text-center shadow-[0_14px_40px_-4px_rgba(0,0,0,0.45)] backdrop-blur-md',
          banner.type === 'info'
            ? 'app-workspace-inset-bg-soft ring-1 ring-app-line-28/70'
            : `${headerNavBarSurface} ring-1 ring-white/10`,
        ].join(' ')}
      >
        <span
          className={`block max-w-full text-pretty text-sm font-semibold leading-snug ${headerBannerTextCls} ${banner.type === 'info' ? 'line-clamp-3 sm:line-clamp-4' : 'line-clamp-2 sm:line-clamp-3'}`}
        >
          {banner.message}
        </span>
      </div>
    </div>,
    document.body,
  )
}

function AdminSedeViewBannerWrapper() {
  const { me } = useMe()
  const [sedeId, setSedeId] = useState<string | null>(null)
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)admin-sede-id=([^;]*)/)
    setSedeId(m?.[1] ? decodeURIComponent(m[1]).trim() : null)
  }, [])
  if (!sedeId || !me?.is_admin) return null
  const sedeNome = me.all_sedi?.find((s) => s.id === sedeId)?.nome?.trim()
  if (!sedeNome) return null
  return <AdminSedeViewBanner sedeNome={sedeNome} />
}

function AppShellMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const normalized = normalizeAppPath(pathname ?? '')
  const hub = showsMobileBottomBar()
  const { me, loading } = useMe()
  const { activeOperator } = useActiveOperator()
  const { visible: homeScannerDockCtaVisible } = useManualDeliverySede()
  const headerToastBanner = useDesktopHeaderToastBanner()
  const { t } = useLocale()
  /** Sfondo barra quando non è attiva la fascia toast (solo riga toolbar). */
  const desktopToolbarOnlySurface =
    'md:bg-transparent md:shadow-none [color:var(--app-fg-body)]'
  const [desktopNavHost, setDesktopNavHost] = useState<HTMLDivElement | null>(null)
  const bindDesktopNavHost = useCallback((el: HTMLDivElement | null) => {
    setDesktopNavHost(el)
  }, [])
  const [desktopSidebarNavHost, setDesktopSidebarNavHost] = useState<HTMLDivElement | null>(null)
  const bindDesktopSidebarNavHost = useCallback((el: HTMLDivElement | null) => {
    setDesktopSidebarNavHost(el)
  }, [])
  const [tabletSidebarOpen, setTabletSidebarOpen] = useState(false)
  const [desktopSidebarHovered, setDesktopSidebarHovered] = useState(false)
  // Close tablet sidebar on genuine navigation (not on router.refresh() which re-emits the same path).
  const sidebarNavPathRef = useRef(pathname ?? '')
  useEffect(() => {
    const p = pathname ?? ''
    if (p === sidebarNavPathRef.current) return
    sidebarNavPathRef.current = p
    setTabletSidebarOpen(false)
  }, [pathname])
  // Also close on browser back/forward (popstate fires for history navigation, not for router.refresh()).
  useEffect(() => {
    const onPop = () => setTabletSidebarOpen(false)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  /** Dock compatto (solo icone) per operatore hub; dock più alto con riga operatore per admin e scheda fornitore. */
  const tallMobileDock =
    (loading && !me) ||
    effectiveIsMasterAdminPlane(me, activeOperator) ||
    isFornitoreProfileRoute(normalized)
  const homeScannerDockCta =
    hub && (normalized === '/' || normalized === '') && homeScannerDockCtaVisible
  /**
   * Padding sotto `#app-main`: deve coprire solo altezza dock + offset `bottom` (~1rem sopra safe area).
   * Valori ~19–22rem erano troppo alti: fascia vuota scura enorme e `useGlassDockOverContent` vedeva sempre
   * “scroll residuo”, attivando il riempimento nero del dock anche in cima alla dashboard.
   */
  const hubBottomPad = homeScannerDockCta
    ? tallMobileDock
      ? 'pb-[calc(14rem+env(safe-area-inset-bottom,0px))]'
      : 'pb-[calc(10.5rem+env(safe-area-inset-bottom,0px))]'
    : tallMobileDock
      ? 'pb-[calc(8.75rem+env(safe-area-inset-bottom,0px))]'
      : 'pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))]'

  // Show splash during initial auth check (only when SSR couldn't pre-load the session)
  if (loading && !me) {
    return <SplashScreen />
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent max-md:min-h-dvh max-md:overflow-x-hidden">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[var(--app-layout-max-width)] flex-1 flex-col max-md:min-h-dvh">
        {/*
          Desktop: griglia a una riga — colonna destra unica: `#app-desktop-header-nav-progress` + `main` nello stesso contenitore flex.
          Sidebar desktop: fissa a sinistra, si sovrappone al contenuto all'hover.
        */}

        {/* ── Desktop sidebar: fixed a sinistra, hover to open ── */}
        <aside
          suppressHydrationWarning
          aria-label={t.nav.mainNavAria ?? 'Navigation'}
          className={`app-sidebar-aside app-shell-rail-clear fixed left-0 top-0 z-40 hidden h-full flex-col transition-all duration-200 ease-in-out lg:flex${desktopSidebarHovered ? ' w-56 shadow-[4px_0_24px_-8px_rgba(0,0,0,0.4)]' : ' w-12'}`}
          onMouseEnter={() => setDesktopSidebarHovered(true)}
          onMouseLeave={() => setDesktopSidebarHovered(false)}
        >
          <div
            ref={bindDesktopSidebarNavHost}
            id={APP_DESKTOP_SIDEBAR_NAV_PROGRESS_ANCHOR_ID}
            className="pointer-events-none absolute inset-0 z-0 min-h-0 overflow-visible"
            aria-hidden
          />
          <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <div className="app-shell-rail-panel flex shrink-0 border-b border-app-line-25">
              <SidebarRailBrand compact={!desktopSidebarHovered} />
            </div>
            <ErrorBoundary sectionName={t.errorBoundary.sectionNavigation}>
              <Sidebar compact={!desktopSidebarHovered} />
            </ErrorBoundary>
          </div>
        </aside>

        <div
          className="app-shell-workspace-canvas flex min-h-0 min-w-0 flex-1 flex-col md:grid md:min-h-0 md:grid-cols-[minmax(0,1fr)] md:grid-rows-[minmax(0,1fr)] lg:grid-cols-[1fr]"
        >
          <DeepAuroraIntegration>
          <SidebarController />

          {/* ── Tablet sidebar overlay (md only, auto-close on navigate) ── */}
          {tabletSidebarOpen && (
            <div
              className="fixed inset-0 z-[200] lg:hidden"
              onClick={() => setTabletSidebarOpen(false)}
            >
              <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" aria-hidden />
              <aside
                className="app-sidebar-aside app-shell-rail-clear relative z-10 flex h-full w-56 shrink-0 flex-col overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                aria-label={t.nav.mainNavAria ?? 'Navigation'}
              >
                <div className="app-shell-rail-panel flex shrink-0 border-b border-app-line-25">
                  <SidebarRailBrand />
                </div>
                <ErrorBoundary sectionName={t.errorBoundary.sectionNavigation}>
                  <Sidebar onClose={() => setTabletSidebarOpen(false)} />
                </ErrorBoundary>
              </aside>
            </div>
          )}

          <div
              data-app-desktop-canvas
              className="flex min-h-0 min-w-0 flex-1 flex-col bg-transparent max-md:min-h-dvh md:col-start-1 md:row-start-1 lg:col-start-1 lg:pl-12 md:h-full md:min-h-0 md:overflow-hidden"
            >
            <DesktopHeaderBannerPortal banner={headerToastBanner} />
            <div
              ref={bindDesktopNavHost}
              id={APP_DESKTOP_HEADER_NAV_PROGRESS_ANCHOR_ID}
              className="relative isolate z-30 hidden min-h-0 min-w-0 shrink-0 overflow-visible border-b border-app-line-25 transition-[background,box-shadow] duration-300 md:flex md:min-h-[52px] md:w-full md:items-stretch lg:min-h-0 lg:h-0 lg:max-h-0 lg:flex-none lg:overflow-hidden lg:border-b-0"
            >
              <div
                className={`relative z-30 flex min-h-[52px] min-w-0 flex-1 items-stretch overflow-visible md:w-full lg:min-h-0 lg:h-0 lg:max-h-0 lg:flex-none lg:overflow-hidden ${desktopToolbarOnlySurface}`}
              >
                {/* Hamburger: visible on md (tablet), hidden on lg (desktop with sidebar) */}
                <button
                  type="button"
                  onClick={() => setTabletSidebarOpen((o) => !o)}
                  className="flex lg:hidden h-full min-h-[52px] w-10 shrink-0 touch-manipulation items-center justify-center border-r border-app-line-25 text-app-fg-muted transition-colors hover:bg-app-line-10 hover:text-app-fg"
                  aria-label={t.nav.menuToggleAria ?? 'Menu'}
                >
                  <svg className={`h-5 w-5 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                  </svg>
                </button>
              </div>
            </div>
            <main
              id="app-main"
              data-app-main-scroll
              className={`app-main-workspace-scroll relative z-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto ps-[env(safe-area-inset-left,0px)] pe-[env(safe-area-inset-right,0px)] md:pt-0 ${
                normalized === '/bolle/new'
                  ? 'pt-0'
                  : 'pt-[calc(3.25rem+0.375rem+env(safe-area-inset-top,0px))] sm:pt-[calc(3.25rem+0.5rem+env(safe-area-inset-top,0px))]'
              } ${hub ? `${hubBottomPad} md:pb-0` : ''}`}
            >
              <Suspense fallback={null}>
                <NavigationTopProgress
                  placement="belowMobileTopbar"
                  desktopHost={desktopNavHost}
                  desktopSidebarHost={desktopSidebarNavHost}
                />
              </Suspense>
              <ErrorBoundary sectionName={t.errorBoundary.sectionSyncBar} fallback={null}>
                <EmailSyncProgressBar />
              </ErrorBoundary>
              <ErrorBoundary sectionName={t.errorBoundary.sectionThisPage}>
                <BranchSessionGate>
                  <Suspense fallback={null}>
                    <AppMainScrollRestoration />
                  </Suspense>
                  <AdminSedeViewBannerWrapper />
                  {children}
                </BranchSessionGate>
              </ErrorBoundary>
            </main>
          </div>
          </DeepAuroraIntegration>
        </div>
      </div>
    </div>
  )
}
