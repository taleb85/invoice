'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Loader2, Trash2 } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { openDocumentUrl } from '@/lib/open-document-url'
import {
  fornitoreBollaDeepLink,
  fornitoreFatturaDeepLink,
  fornitoreSupplierCloseDocHref,
} from '@/lib/fornitore-supplier-url'
import { buildListLocationPath, hrefWithReturnTo } from '@/lib/return-navigation'
import { saveScrollForListPath } from '@/lib/return-navigation-client'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate as formatDateLib } from '@/lib/locale'
import type { Locale } from '@/lib/translations'
import ToggleStato from '@/app/(app)/bolle/[id]/ToggleStato'
import ReplaceFileButton from '@/app/(app)/fatture/[id]/ReplaceFileButton'
import type { BollaStato } from '@/types'
import { attachmentKindFromFileUrl, embedSrcForInlineViewer } from '@/lib/attachment-kind'
import { useMe } from '@/lib/me-context'
import ListinoDocReferenceTable from '@/components/ListinoDocReferenceTable'
import { createClient } from '@/utils/supabase/client'
import { fornitoreNomeMaiuscolo } from '@/lib/fornitore-display'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'

type BollaPayload = {
  id: string
  data: string
  stato: BollaStato
  file_url: string | null
  fornitore_id: string
  importo: number | null
  numero_bolla: string | null
  fornitore?: { nome: string; email: string | null; piva: string | null; rekki_supplier_id?: string | null } | null
}

type FatturaPayload = {
  id: string
  data: string
  file_url: string | null
  fornitore_id: string
  fornitore?: { nome: string; email: string | null; piva: string | null } | null
  bolla?: { id: string; data: string; stato: string } | null
}

function useSignedDocumentUrl(openKind: 'bolla' | 'fattura' | null, docId: string | null) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!openKind || !docId?.trim()) {
      setSignedUrl(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setSignedUrl(null)
    const href =
      openKind === 'bolla'
        ? openDocumentUrl({ bollaId: docId, json: true })
        : openDocumentUrl({ fatturaId: docId, json: true })
    fetch(href, { credentials: 'include' })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json() as Promise<{ url?: string }>
      })
      .then((j) => {
        if (cancelled) return
        const u = j.url?.trim()
        setSignedUrl(u ?? null)
      })
      .catch(() => {
        if (!cancelled) setSignedUrl(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [openKind, docId])

  return { signedUrl, loading }
}

const VIEWER_Z_MIN = 0.5
const VIEWER_Z_MAX = 3
const VIEWER_Z_STEP = 0.25

function clampViewerZoom(n: number): number {
  return Math.min(VIEWER_Z_MAX, Math.max(VIEWER_Z_MIN, Math.round(n * 100) / 100))
}

/** Anteprima PDF/immagine nel layer fornitore (solo contenuto, senza chrome Allegato / nuova scheda). */
function FornitoreInlineDocPreview({
  fileUrl,
  openKind,
  docId,
  fill,
}: {
  fileUrl: string | null | undefined
  openKind: 'bolla' | 'fattura'
  docId: string
  /** Riempie l’area del modale sotto l’header (solo PDF / immagine). */
  fill?: boolean
}) {
  const t = useT()
  const [zoom, setZoom] = useState(1)
  const z = clampViewerZoom(zoom)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { signedUrl, loading } = useSignedDocumentUrl(fileUrl?.trim() ? openKind : null, fileUrl?.trim() ? docId : null)
  const kind = attachmentKindFromFileUrl(fileUrl)
  const hrefTab =
    openKind === 'bolla' ? openDocumentUrl({ bollaId: docId }) : openDocumentUrl({ fatturaId: docId })
  const previewTitle = t.common.attachment

  useEffect(() => {
    setZoom(1)
  }, [docId, openKind, fileUrl])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom((prev) =>
        clampViewerZoom(prev + (e.deltaY < 0 ? 0.12 : -0.12)),
      )
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [signedUrl, loading])

  if (!fileUrl?.trim()) return null

  const frameFixed = 'h-[min(78vh,880px)]'
  const shell = fill
    ? 'flex min-h-0 flex-1 flex-col overflow-hidden app-workspace-surface-elevated'
    : 'flex min-h-0 flex-col overflow-hidden rounded-lg border border-app-line-15 app-workspace-surface-elevated'
  const frameLoading = fill ? 'flex flex-1 items-center justify-center' : `flex ${frameFixed} items-center justify-center`
  const zoomBtn =
    'inline-flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-lg border border-app-line-28 bg-black/25 px-2 text-sm font-semibold text-app-fg transition-colors hover:border-app-cyan-500/35 hover:bg-black/35 disabled:cursor-not-allowed disabled:opacity-40'

  const showZoomUi = !loading

  const zoomBar = showZoomUi ? (
    <div
      className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-app-line-22/80 bg-[#0a1420]/95 px-2 py-1.5"
      role="toolbar"
      aria-label="Zoom"
    >
      <button
        type="button"
        className={zoomBtn}
        aria-label={t.common.viewerZoomOut}
        title={t.common.viewerZoomOut}
        disabled={z <= VIEWER_Z_MIN}
        onClick={() => setZoom((x) => clampViewerZoom(x - VIEWER_Z_STEP))}
      >
        −
      </button>
      <span className="min-w-[3.25rem] text-center text-xs tabular-nums text-app-fg-muted">{Math.round(z * 100)}%</span>
      <button
        type="button"
        className={zoomBtn}
        aria-label={t.common.viewerZoomIn}
        title={t.common.viewerZoomIn}
        disabled={z >= VIEWER_Z_MAX}
        onClick={() => setZoom((x) => clampViewerZoom(x + VIEWER_Z_STEP))}
      >
        +
      </button>
      <button
        type="button"
        className={`${zoomBtn} text-xs font-medium`}
        aria-label={t.common.viewerZoomReset}
        title={t.common.viewerZoomReset}
        onClick={() => setZoom(1)}
      >
        100%
      </button>
      <span className="hidden w-full text-center text-[10px] text-app-fg-muted/80 sm:ml-1 sm:inline sm:w-auto">
        {t.common.viewerZoomHint}
      </span>
    </div>
  ) : null

  return (
    <div className={shell}>
      {zoomBar}
      {loading && (
        <div className={frameLoading}>
          <p className="text-xs text-app-fg-muted">{t.common.loading}</p>
        </div>
      )}
      {!loading && signedUrl && kind === 'image' && (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-auto overscroll-contain touch-pan-x touch-pan-y"
        >
          <div className="flex w-full min-w-full justify-center p-1 sm:p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL firmato esterno / storage */}
            <img
              src={signedUrl}
              alt=""
              style={{ width: `${z * 100}%`, maxWidth: z > 1 ? 'none' : undefined, height: 'auto' }}
              className={
                fill
                  ? 'mx-auto h-auto max-h-full min-h-0 w-full max-w-full object-contain'
                  : 'mx-auto h-auto max-h-[min(72vh,820px)] w-full max-w-full object-contain'
              }
            />
          </div>
        </div>
      )}
      {!loading && signedUrl && kind !== 'image' && (
        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-auto overscroll-contain"
        >
          <iframe
            title={previewTitle}
            src={embedSrcForInlineViewer(signedUrl, kind)}
            style={{
              display: 'block',
              minHeight: fill
                ? `min(${Math.min(96, 38 + 42 * z)}dvh, ${Math.min(1200, 520 + 260 * (z - VIEWER_Z_MIN))}px)`
                : undefined,
              width: `${z * 100}%`,
              maxWidth: 'none',
            }}
            className={
              fill
                ? 'min-h-0 w-full min-w-0 border-0 app-workspace-surface-elevated'
                : `${frameFixed} w-full min-w-0 border-0 app-workspace-surface-elevated`
            }
          />
        </div>
      )}
      {!loading && !signedUrl && (
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain" ref={scrollRef}>
          <iframe
            title={previewTitle}
            src={hrefTab}
            style={fill ? { width: `${z * 100}%`, minHeight: 'min(70dvh, 820px)' } : undefined}
            className={
              fill
                ? 'min-h-0 w-full min-w-0 border-0 app-workspace-surface-elevated'
                : `${frameFixed} w-full min-w-0 border-0 app-workspace-surface-elevated`
            }
          />
        </div>
      )}
    </div>
  )
}

export default function FornitoreDocDetailLayer({
  fornitoreId,
  bollaId,
  fatturaId,
  onAfterDelete,
}: {
  fornitoreId: string
  bollaId: string | null
  fatturaId: string | null
  onAfterDelete?: () => void
}) {
  const t = useT()
  const { locale, timezone } = useLocale()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const close = useCallback(() => {
    router.push(fornitoreSupplierCloseDocHref(pathname, searchParams), { scroll: false })
  }, [pathname, router, searchParams])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const showFattura = Boolean(fatturaId)
  const showBolla = Boolean(bollaId) && !showFattura
  const layerOpen = showFattura || showBolla

  const [portalReady, setPortalReady] = useState(false)
  useLayoutEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!layerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [layerOpen])

  if (!layerOpen) return null
  if (!portalReady) return null

  /**
   * `DashboardMobileBottomNav` è sibling di `AppShellMain` (z-100) ed è dopo il main nel DOM:
   * un `fixed` dentro `#app-main` non può stare sopra al dock, qualunque z-index. Portal su
   * `body` e z tra dock (100) e OperatorSwitchModal (220).
   */
  return createPortal(
    <div
      className="fixed inset-0 z-[215] flex min-h-0 items-stretch justify-center app-workspace-inset-bg p-0 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fornitore-doc-detail-title"
    >
      <button
        type="button"
        aria-label={t.statements.btnClose}
        className="absolute inset-0 z-0 cursor-default md:hidden"
        onClick={close}
      />
      <div className="relative z-10 flex h-full min-h-0 max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-none border border-app-line-22 bg-gradient-to-br from-[#0b1524] via-[#152238] to-[#121f2e] shadow-2xl pb-[env(safe-area-inset-bottom,0px)] md:max-h-[min(96dvh,960px)] md:max-w-[min(96vw,1280px)] md:pb-0 md:rounded-xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-app-line-22 px-3 py-2.5 md:px-4">
          <h2 id="fornitore-doc-detail-title" className="min-w-0 truncate text-sm font-semibold text-app-fg">
            {showFattura ? t.fatture.invoice : t.bolle.dettaglio}
          </h2>
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-app-fg-muted transition-colors hover:bg-black/18 hover:text-app-fg"
          >
            {t.statements.btnClose}
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain">
          {showFattura && fatturaId && (
            <FatturaLayerBody
              fatturaId={fatturaId}
              fornitoreId={fornitoreId}
              pathname={pathname}
              searchParams={searchParams}
              locale={locale}
              timezone={timezone}
              close={close}
              onAfterDelete={onAfterDelete}
            />
          )}
          {showBolla && bollaId && (
            <BollaLayerBody
              bollaId={bollaId}
              fornitoreId={fornitoreId}
              pathname={pathname}
              searchParams={searchParams}
              locale={locale}
              timezone={timezone}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function FatturaLayerBody({
  fatturaId,
  fornitoreId,
  pathname,
  searchParams,
  locale,
  timezone,
  close,
  onAfterDelete,
}: {
  fatturaId: string
  fornitoreId: string
  pathname: string
  searchParams: ReturnType<typeof useSearchParams>
  locale: Locale
  timezone: string
  close: () => void
  onAfterDelete?: () => void
}) {
  const t = useT()
  const { me } = useMe()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [fattura, setFattura] = useState<FatturaPayload | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    fetch(`/api/viewer/fattura/${fatturaId}`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error((j as { error?: string }).error ?? res.statusText)
        }
        return res.json() as Promise<{ fattura: FatturaPayload }>
      })
      .then(({ fattura: f }) => {
        if (cancelled) return
        if (f.fornitore_id !== fornitoreId) {
          setErr('mismatch')
          setFattura(null)
        } else {
          setFattura(f)
        }
      })
      .catch(() => {
        if (!cancelled) setErr('load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [fatturaId, fornitoreId])

  const formatDate = (d: string) => formatDateLib(d, locale, timezone, { day: '2-digit', month: 'short', year: 'numeric' })

  const isAdmin = Boolean(me?.is_admin || me?.is_admin_sede)

  const handleDelete = async () => {
    if (!fattura) return
    if (!confirm(t.fatture.deleteConfirm)) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('fatture').delete().eq('id', fattura.id)
    setDeleting(false)
    if (error) {
      alert(`${t.appStrings.deleteFailed} ${error.message}`)
      return
    }
    onAfterDelete?.()
    close()
  }

  const deleteBtn = isAdmin ? (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(34,211,238,0.15)] bg-red-950/45 px-3 py-1.5 text-xs font-semibold text-red-200 shadow-sm transition-colors hover:border-[rgba(34,211,238,0.15)] hover:bg-red-600/25 hover:text-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {deleting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Trash2 className={`h-3.5 w-3.5 ${icon.destructive}`} aria-hidden strokeWidth={2} />
      )}
      {t.common.delete}
    </button>
  ) : null

  const scrollPad = 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6 md:py-6'

  if (loading) {
    return (
      <div className={scrollPad}>
        <p className="text-sm text-app-fg-muted">{t.common.loading}</p>
      </div>
    )
  }
  if (err || !fattura) {
    return (
      <div className={`${scrollPad} space-y-3 text-center`}>
        <p className="text-sm text-app-fg-muted">{t.appStrings.docUnavailableFatturaDesc}</p>
        <Link href={`/fatture/${fatturaId}`} className="text-sm font-medium text-app-cyan-500 hover:text-app-fg-muted">
          {t.fatture.dettaglio} →
        </Link>
      </div>
    )
  }

  if (fattura.file_url?.trim()) {
    const listinoAdmin = Boolean(me?.is_admin || me?.is_admin_sede)
    return (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <FornitoreInlineDocPreview
          fill
          fileUrl={fattura.file_url}
          openKind="fattura"
          docId={fattura.id}
        />
        <div className="shrink-0 border-t border-app-line-22/90 bg-black/20 px-4 py-2.5 md:px-5">
          <p className="text-[11px] leading-relaxed text-app-fg-muted">{t.appStrings.listinoDocDetailImportHint}</p>
          {listinoAdmin ? (
            <p className="mt-1 text-[10px] leading-snug text-app-fg-muted/85">{t.appStrings.listinoDocDetailImportHintAdmin}</p>
          ) : null}
          {deleteBtn && <div className="mt-2">{deleteBtn}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className={`${scrollPad} space-y-4`}>
      <div>
        <h3 className="text-lg font-bold text-app-fg">
          {t.fatture.invoice} – {fornitoreNomeMaiuscolo(fattura.fornitore?.nome)}
        </h3>
        <p className="mt-0.5 text-sm text-app-fg-muted">{formatDate(fattura.data)}</p>
      </div>

      <div className="app-card flex flex-col overflow-hidden rounded-xl border border-app-line-22">
        <div className="p-5">
          <h4 className="mb-3 text-sm font-semibold text-app-fg">{t.fatture.dettaglio}</h4>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-app-fg-muted">{t.common.supplier}</dt>
              <dd className="font-medium text-app-fg">{fornitoreNomeMaiuscolo(fattura.fornitore?.nome)}</dd>
            </div>
            {fattura.fornitore?.email && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-app-fg-muted">{t.fornitori.email}</dt>
                <dd className="text-app-fg-muted">{fattura.fornitore.email}</dd>
              </div>
            )}
            {fattura.fornitore?.piva && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-app-fg-muted">{t.fornitori.piva}</dt>
                <dd className="text-app-fg-muted">{fattura.fornitore.piva}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-app-fg-muted">{t.common.date}</dt>
              <dd className="text-app-fg-muted">{formatDate(fattura.data)}</dd>
            </div>
            {fattura.bolla && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-app-fg-muted">{t.fatture.bollaCollegata}</dt>
                <dd>
                  <Link
                    href={fornitoreBollaDeepLink(pathname, searchParams, fattura.bolla.id)}
                    scroll={false}
                    className="font-medium text-app-cyan-500 transition-colors hover:text-app-fg-muted"
                  >
                    {formatDate(fattura.bolla.data)} →
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="app-card flex flex-col overflow-hidden rounded-xl border border-app-line-22">
        <div className="p-5">
          <h4 className="mb-3 text-sm font-semibold text-app-fg">{t.common.actions}</h4>
          <p className="mb-3 text-sm text-app-fg-muted">Nessun allegato</p>
          <div className="flex flex-wrap gap-2">
            <ReplaceFileButton fatturaId={fattura.id} />
            {deleteBtn}
          </div>
        </div>
      </div>

      <p className="text-center">
        <Link href={`/fatture/${fattura.id}`} className="text-xs text-app-fg-muted underline hover:text-app-fg">
          {t.common.detail} — {t.nav.fatture}
        </Link>
      </p>
    </div>
  )
}

function BollaLayerBody({
  bollaId,
  fornitoreId,
  pathname,
  searchParams,
  locale,
  timezone,
}: {
  bollaId: string
  fornitoreId: string
  pathname: string
  searchParams: ReturnType<typeof useSearchParams>
  locale: Locale
  timezone: string
}) {
  const t = useT()
  const supplierReturnPath = buildListLocationPath(pathname, searchParams)
  const { me } = useMe()
  const allowListinoForce = Boolean(me)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [bolla, setBolla] = useState<BollaPayload | null>(null)
  const [fatture, setFatture] = useState<{ id: string; data: string; file_url: string | null }[]>([])
  const [rekkiPrezzoFlag, setRekkiPrezzoFlag] = useState(false)
  const [listinoRows, setListinoRows] = useState<{ prodotto: string; prezzo: number; data_prezzo: string }[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    fetch(`/api/viewer/bolla/${bollaId}`)
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error((j as { error?: string }).error ?? res.statusText)
        }
        return res.json() as Promise<{
          bolla: BollaPayload
          fatture: { id: string; data: string; file_url: string | null }[]
          rekkiPrezzoFlag: boolean
          listinoRows: { prodotto: string; prezzo: number; data_prezzo: string }[]
        }>
      })
      .then((body) => {
        if (cancelled) return
        if (body.bolla.fornitore_id !== fornitoreId) {
          setErr('mismatch')
          setBolla(null)
        } else {
          setBolla(body.bolla)
          setFatture(body.fatture ?? [])
          setRekkiPrezzoFlag(body.rekkiPrezzoFlag)
          setListinoRows(body.listinoRows ?? [])
        }
      })
      .catch(() => {
        if (!cancelled) setErr('load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [bollaId, fornitoreId])

  const formatDate = (d: string) => formatDateLib(d, locale, timezone, { day: '2-digit', month: 'short', year: 'numeric' })

  const scrollPad = 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6 md:py-6'

  if (loading) {
    return (
      <div className={scrollPad}>
        <p className="text-sm text-app-fg-muted">{t.common.loading}</p>
      </div>
    )
  }
  if (err || !bolla) {
    return (
      <div className={`${scrollPad} space-y-3 text-center`}>
        <p className="text-sm text-app-fg-muted">{t.appStrings.docUnavailableBollaDesc}</p>
        <Link href={`/bolle/${bollaId}`} className="text-sm font-medium text-app-cyan-500 hover:text-app-fg-muted">
          {t.bolle.dettaglio} →
        </Link>
      </div>
    )
  }

  if (bolla.file_url?.trim()) {
    return (
      <FornitoreInlineDocPreview fill fileUrl={bolla.file_url} openKind="bolla" docId={bolla.id} />
    )
  }

  const fornitoreRekkiId = bolla.fornitore?.rekki_supplier_id?.trim()

  return (
    <div className={`${scrollPad} space-y-4`}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-bold text-app-fg">{fornitoreNomeMaiuscolo(bolla.fornitore?.nome)}</h3>
          {rekkiPrezzoFlag && (
            <span className="inline-flex max-w-full min-w-0 shrink items-center rounded-full border border-[rgba(34,211,238,0.15)] bg-amber-950/50 px-2 py-1 text-[10px] font-semibold text-amber-50">
              {t.bolle.rekkiPrezzoIndicativoBadge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-app-fg-muted">{formatDate(bolla.data)}</p>
      </div>

      <div className="app-card flex flex-col overflow-hidden rounded-xl border border-app-line-22">
        <div className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-app-fg">{t.bolle.dettaglio}</h4>
            <ToggleStato id={bolla.id} stato={bolla.stato} />
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-app-fg-muted">{t.common.supplier}</dt>
              <dd className="font-medium text-app-fg">{fornitoreNomeMaiuscolo(bolla.fornitore?.nome)}</dd>
            </div>
            {bolla.numero_bolla && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-app-fg-muted">{t.appStrings.colDeliveryNoteNum}</dt>
                <dd className="font-mono font-medium text-app-fg">{bolla.numero_bolla}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-app-fg-muted">{t.common.date}</dt>
              <dd className="text-app-fg-muted">{formatDate(bolla.data)}</dd>
            </div>
            {bolla.importo != null && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-app-fg-muted">{t.statements.colAmount}</dt>
                <dd className="font-semibold text-app-fg">£ {Number(bolla.importo).toFixed(2)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {fornitoreRekkiId && (
        <div className="app-card flex flex-col overflow-hidden rounded-xl border border-app-line-22">
          <div className="p-5">
            <h4 className="mb-2 text-sm font-semibold text-app-fg">{t.bolle.listinoRekkiRefTitle}</h4>
            <p className="mb-3 text-[11px] text-app-fg-muted">{t.bolle.listinoRekkiRefHint}</p>
            {listinoRows.length === 0 ? (
              <p className="text-sm text-app-fg-muted">{t.bolle.listinoRekkiRefEmpty}</p>
            ) : (
              <ListinoDocReferenceTable
                documentDateIso={bolla.data}
                fornitoreId={bolla.fornitore_id}
                rows={listinoRows}
                allowAdminForce={allowListinoForce}
              />
            )}
          </div>
        </div>
      )}

      <div className="app-card flex flex-col overflow-hidden rounded-xl border border-app-line-22">
        <div className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-app-fg">{t.bolle.fattureCollegate}</h4>
            <Link
              href={hrefWithReturnTo(
                `/fatture/new?bolla_id=${bolla.id}&fornitore_id=${bolla.fornitore_id}`,
                supplierReturnPath,
              )}
              onClick={() => saveScrollForListPath(supplierReturnPath)}
              className="text-xs font-medium text-app-cyan-500 hover:text-app-fg-muted"
            >
              {t.bolle.aggiungi}
            </Link>
          </div>
          {fatture.length === 0 ? (
            <p className="text-sm text-app-fg-muted">{t.bolle.nessunaFatturaCollegata}</p>
          ) : (
            <div className="space-y-1">
              {fatture.map((f) => (
                <Link
                  key={f.id}
                  href={fornitoreFatturaDeepLink(pathname, searchParams, f.id)}
                  scroll={false}
                  className="-mx-2 flex items-center justify-between rounded px-2 py-2 text-sm text-app-fg-muted transition-colors hover:bg-black/12"
                >
                  <span>{formatDate(f.data)}</span>
                  {f.file_url && <span className="text-xs font-medium text-app-cyan-500">{t.bolle.allegatoLink}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-center">
        <Link href={`/bolle/${bolla.id}`} className="text-xs text-app-fg-muted underline hover:text-app-fg">
          {t.common.detail} — {t.nav.bolle}
        </Link>
      </p>
    </div>
  )
}
