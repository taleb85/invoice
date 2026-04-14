'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { openDocumentUrl } from '@/lib/open-document-url'
import {
  fornitoreBollaDeepLink,
  fornitoreFatturaDeepLink,
  fornitoreSupplierCloseDocHref,
} from '@/lib/fornitore-supplier-url'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate as formatDateLib } from '@/lib/locale'
import type { Locale } from '@/lib/translations'
import ToggleStato from '@/app/(app)/bolle/[id]/ToggleStato'
import ReplaceFileButton from '@/app/(app)/fatture/[id]/ReplaceFileButton'
import type { BollaStato } from '@/types'
import { attachmentKindFromFileUrl } from '@/lib/attachment-kind'

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
  const { signedUrl, loading } = useSignedDocumentUrl(fileUrl?.trim() ? openKind : null, fileUrl?.trim() ? docId : null)
  const kind = attachmentKindFromFileUrl(fileUrl)
  const hrefTab =
    openKind === 'bolla' ? openDocumentUrl({ bollaId: docId }) : openDocumentUrl({ fatturaId: docId })
  const previewTitle = t.common.attachment

  if (!fileUrl?.trim()) return null

  const frameFixed = 'h-[min(58vh,560px)]'
  const shell = fill
    ? 'flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-700'
    : 'overflow-hidden rounded-xl border border-slate-700/60 bg-slate-700'
  const frameLoading = fill ? 'flex flex-1 items-center justify-center' : `flex ${frameFixed} items-center justify-center`
  const frameFallback = fill ? 'flex flex-1 items-center justify-center p-4' : `flex ${frameFixed} items-center justify-center p-4`

  return (
    <div className={shell}>
      {loading && (
        <div className={frameLoading}>
          <p className="text-xs text-slate-500">{t.common.loading}</p>
        </div>
      )}
      {!loading && signedUrl && kind === 'image' && (
        // eslint-disable-next-line @next/next/no-img-element -- URL firmato esterno / storage
        <img
          src={signedUrl}
          alt=""
          className={
            fill
              ? 'mx-auto max-h-full min-h-0 w-auto max-w-full flex-1 object-contain'
              : 'mx-auto max-h-[min(55vh,520px)] w-auto max-w-full object-contain'
          }
        />
      )}
      {!loading && signedUrl && kind !== 'image' && (
        <iframe
          title={previewTitle}
          src={signedUrl}
          className={
            fill
              ? 'min-h-0 w-full flex-1 border-0 bg-slate-700'
              : `${frameFixed} w-full border-0 bg-slate-700`
          }
        />
      )}
      {!loading && !signedUrl && (
        <div className={frameFallback}>
          <a
            href={hrefTab}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
          >
            {t.common.openAttachment}
          </a>
        </div>
      )}
    </div>
  )
}

export default function FornitoreDocDetailLayer({
  fornitoreId,
  bollaId,
  fatturaId,
}: {
  fornitoreId: string
  bollaId: string | null
  fatturaId: string | null
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

  if (!showFattura && !showBolla) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex items-stretch justify-center bg-slate-700/80 p-0 backdrop-blur-sm md:p-6"
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
      <div className="relative z-10 flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-none border border-slate-700/60 bg-gradient-to-br from-[#0b1524] via-[#152238] to-[#121f2e] shadow-2xl md:max-h-[min(92vh,900px)] md:max-w-[min(96vw,1280px)] md:rounded-xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-700/60 px-3 py-2.5 md:px-4">
          <h2 id="fornitore-doc-detail-title" className="min-w-0 truncate text-sm font-semibold text-slate-100">
            {showFattura ? t.fatture.invoice : t.bolle.dettaglio}
          </h2>
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700/80 hover:text-slate-100"
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
    </div>
  )
}

function FatturaLayerBody({
  fatturaId,
  fornitoreId,
  pathname,
  searchParams,
  locale,
  timezone,
}: {
  fatturaId: string
  fornitoreId: string
  pathname: string
  searchParams: ReturnType<typeof useSearchParams>
  locale: Locale
  timezone: string
}) {
  const t = useT()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [fattura, setFattura] = useState<FatturaPayload | null>(null)

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

  const scrollPad = 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6 md:py-6'

  if (loading) {
    return (
      <div className={scrollPad}>
        <p className="text-sm text-slate-200">{t.common.loading}</p>
      </div>
    )
  }
  if (err || !fattura) {
    return (
      <div className={`${scrollPad} space-y-3 text-center`}>
        <p className="text-sm text-slate-200">{t.appStrings.docUnavailableFatturaDesc}</p>
        <Link href={`/fatture/${fatturaId}`} className="text-sm font-medium text-cyan-400 hover:text-cyan-300">
          {t.fatture.dettaglio} →
        </Link>
      </div>
    )
  }

  if (fattura.file_url?.trim()) {
    return (
      <FornitoreInlineDocPreview
        fill
        fileUrl={fattura.file_url}
        openKind="fattura"
        docId={fattura.id}
      />
    )
  }

  return (
    <div className={`${scrollPad} space-y-4`}>
      <div>
        <h3 className="text-lg font-bold text-slate-100">
          {t.fatture.invoice} – {fattura.fornitore?.nome}
        </h3>
        <p className="mt-0.5 text-sm text-slate-200">{formatDate(fattura.data)}</p>
      </div>

      <div className="app-card flex flex-col overflow-hidden rounded-xl border border-slate-700/50">
        <div className="app-card-bar shrink-0" aria-hidden />
        <div className="p-5">
          <h4 className="mb-3 text-sm font-semibold text-slate-100">{t.fatture.dettaglio}</h4>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-200">{t.common.supplier}</dt>
              <dd className="font-medium text-slate-100">{fattura.fornitore?.nome}</dd>
            </div>
            {fattura.fornitore?.email && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-slate-200">{t.fornitori.email}</dt>
                <dd className="text-slate-200">{fattura.fornitore.email}</dd>
              </div>
            )}
            {fattura.fornitore?.piva && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-slate-200">{t.fornitori.piva}</dt>
                <dd className="text-slate-200">{fattura.fornitore.piva}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-200">{t.common.date}</dt>
              <dd className="text-slate-200">{formatDate(fattura.data)}</dd>
            </div>
            {fattura.bolla && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-slate-200">{t.fatture.bollaCollegata}</dt>
                <dd>
                  <Link
                    href={fornitoreBollaDeepLink(pathname, searchParams, fattura.bolla.id)}
                    scroll={false}
                    className="font-medium text-cyan-400 transition-colors hover:text-cyan-300"
                  >
                    {formatDate(fattura.bolla.data)} →
                  </Link>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <div className="app-card flex flex-col overflow-hidden rounded-xl border border-slate-700/50">
        <div className="app-card-bar shrink-0" aria-hidden />
        <div className="p-5">
          <h4 className="mb-3 text-sm font-semibold text-slate-100">{t.common.actions}</h4>
          <p className="mb-3 text-sm text-slate-500">Nessun allegato</p>
          <ReplaceFileButton fatturaId={fattura.id} />
        </div>
      </div>

      <p className="text-center">
        <Link href={`/fatture/${fattura.id}`} className="text-xs text-slate-500 underline hover:text-slate-200">
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
        <p className="text-sm text-slate-200">{t.common.loading}</p>
      </div>
    )
  }
  if (err || !bolla) {
    return (
      <div className={`${scrollPad} space-y-3 text-center`}>
        <p className="text-sm text-slate-200">{t.appStrings.docUnavailableBollaDesc}</p>
        <Link href={`/bolle/${bollaId}`} className="text-sm font-medium text-cyan-400 hover:text-cyan-300">
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
          <h3 className="text-lg font-bold text-slate-100">{bolla.fornitore?.nome}</h3>
          {rekkiPrezzoFlag && (
            <span className="inline-flex max-w-full min-w-0 shrink items-center rounded-full border border-amber-400/45 bg-amber-950/50 px-2 py-1 text-[10px] font-semibold text-amber-50">
              {t.bolle.rekkiPrezzoIndicativoBadge}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-slate-200">{formatDate(bolla.data)}</p>
      </div>

      <div className="app-card flex flex-col overflow-hidden rounded-xl border border-slate-700/50">
        <div className="app-card-bar shrink-0" aria-hidden />
        <div className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-100">{t.bolle.dettaglio}</h4>
            <ToggleStato id={bolla.id} stato={bolla.stato} />
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-200">{t.common.supplier}</dt>
              <dd className="font-medium text-slate-100">{bolla.fornitore?.nome}</dd>
            </div>
            {bolla.numero_bolla && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-slate-200">{t.appStrings.colDeliveryNoteNum}</dt>
                <dd className="font-mono font-medium text-slate-100">{bolla.numero_bolla}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-200">{t.common.date}</dt>
              <dd className="text-slate-200">{formatDate(bolla.data)}</dd>
            </div>
            {bolla.importo != null && (
              <div className="flex gap-2">
                <dt className="w-28 shrink-0 text-slate-200">{t.statements.colAmount}</dt>
                <dd className="font-semibold text-slate-100">£ {Number(bolla.importo).toFixed(2)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {fornitoreRekkiId && (
        <div className="app-card flex flex-col overflow-hidden rounded-xl border border-slate-700/50">
          <div className="app-card-bar shrink-0" aria-hidden />
          <div className="p-5">
            <h4 className="mb-2 text-sm font-semibold text-slate-100">{t.bolle.listinoRekkiRefTitle}</h4>
            <p className="mb-3 text-[11px] text-slate-500">{t.bolle.listinoRekkiRefHint}</p>
            {listinoRows.length === 0 ? (
              <p className="text-sm text-slate-500">{t.bolle.listinoRekkiRefEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-700/60 text-slate-500">
                      <th className="py-2 pr-3 font-medium">{t.fornitori.listinoProdotti}</th>
                      <th className="py-2 pr-3 text-right font-medium">{t.fornitori.listinoColImporto}</th>
                      <th className="py-2 font-medium">{t.fornitori.listinoColData}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {listinoRows.map((row) => (
                      <tr key={`${row.prodotto}-${row.data_prezzo}`}>
                        <td className="max-w-[200px] truncate py-2 pr-3 text-slate-200">{row.prodotto}</td>
                        <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-100">
                          {Number(row.prezzo).toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap py-2 text-slate-500">{formatDate(row.data_prezzo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="app-card flex flex-col overflow-hidden rounded-xl border border-slate-700/50">
        <div className="app-card-bar shrink-0" aria-hidden />
        <div className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-100">{t.bolle.fattureCollegate}</h4>
            <Link
              href={`/fatture/new?bolla_id=${bolla.id}&fornitore_id=${bolla.fornitore_id}`}
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300"
            >
              {t.bolle.aggiungi}
            </Link>
          </div>
          {fatture.length === 0 ? (
            <p className="text-sm text-slate-500">{t.bolle.nessunaFatturaCollegata}</p>
          ) : (
            <div className="space-y-1">
              {fatture.map((f) => (
                <Link
                  key={f.id}
                  href={fornitoreFatturaDeepLink(pathname, searchParams, f.id)}
                  scroll={false}
                  className="-mx-2 flex items-center justify-between rounded px-2 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-700/50"
                >
                  <span>{formatDate(f.data)}</span>
                  {f.file_url && <span className="text-xs font-medium text-cyan-400">{t.bolle.allegatoLink}</span>}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-center">
        <Link href={`/bolle/${bolla.id}`} className="text-xs text-slate-500 underline hover:text-slate-200">
          {t.common.detail} — {t.nav.bolle}
        </Link>
      </p>
    </div>
  )
}
