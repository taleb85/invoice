'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { SupplierAnomalieApiResponse, SupplierAnomalieApiRow } from '@/app/api/fornitori/[id]/anomalie/route'
import { DocumentRowActions } from '@/components/DocumentRowActions'
import { documentActionItemFromAnomalieRow } from '@/lib/document-action-item'
import { attachmentKindFromFileUrl } from '@/lib/attachment-kind'
import AppSectionEmptyState from '@/components/AppSectionEmptyState'
import { useT } from '@/lib/use-t'
import { useLocale } from '@/lib/locale-context'
import { formatDate as formatDateLib, formatCurrency } from '@/lib/locale'
import { SUPPLIER_DETAIL_TAB_HIGHLIGHT } from '@/lib/supplier-detail-tab-theme'
import {
  APP_SECTION_DIVIDE_ROWS,
  APP_SECTION_MOBILE_LIST,
} from '@/lib/app-shell-layout'
import {
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_THEAD_STICKY,
  APP_SECTION_TABLE_TR,
  SUPPLIER_LEDGER_TABLE,
  SUPPLIER_LEDGER_TABLE_WRAP,
  SUPPLIER_LEDGER_TD,
  SUPPLIER_LEDGER_TD_ACTIONS,
  SUPPLIER_LEDGER_TD_AMOUNT,
  SUPPLIER_LEDGER_TD_DATE,
  SUPPLIER_LEDGER_TH,
  SUPPLIER_LEDGER_TH_AMOUNT,
  SUPPLIER_LEDGER_TH_RIGHT,
  supplierLedgerTableHeadRow,
} from '@/lib/supplier-detail-ledger-table'
import { createClient } from '@/utils/supabase/client'
import { fornitoreBollaDeepLink, fornitoreFatturaDeepLink, fornitoreDocumentiQueueHref } from '@/lib/fornitore-supplier-url'
import { deliveryNoteTermForList } from '@/lib/localization'
import type { ReadonlyURLSearchParams } from 'next/navigation'

type TabTarget = 'listino' | 'verifica' | 'fatture' | 'bolle' | 'documenti'

function issueLabel(
  row: SupplierAnomalieApiRow,
  t: ReturnType<typeof useT>,
  countryCode: string,
): string {
  const deliveryNote = deliveryNoteTermForList(countryCode)
  switch (row.kind) {
    case 'fattura_duplicata':
      return row.meta?.duplicateRole === 'canonical'
        ? t.fornitori.anomalieIssueDupCanonical
        : t.fornitori.anomalieIssueDupExcess
    case 'bolla_duplicata':
      return row.meta?.duplicateRole === 'canonical'
        ? t.fornitori.anomalieIssueDupCanonical
        : t.fornitori.anomalieIssueDupBolla.replace('{deliveryNote}', deliveryNote)
    case 'bolla_aperta':
      return t.fornitori.anomalieIssueBollaAperta.replace('{deliveryNote}', deliveryNote)
    case 'prezzo_listino':
      return row.id === 'rekki-summary' ? t.fornitori.anomalieIssueRekki : t.fornitori.anomalieIssuePrezzo
    case 'estratto_conto':
      return t.fornitori.anomalieIssueEstratto
    case 'documento_coda':
      return t.fornitori.anomalieIssueCoda
    case 'fornitore_stesso_dominio':
      return t.fornitori.anomalieIssueStessoDominio
  }
}

function registeredDateHint(
  row: SupplierAnomalieApiRow,
  t: ReturnType<typeof useT>,
  formatDate: (iso: string | null) => string,
): string | null {
  const iso = row.meta?.registeredData?.trim()
  if (!iso) return null
  return t.fornitori.anomalieRegisteredDateHint.replace('{date}', formatDate(iso))
}

function issueBadgeClass(row: SupplierAnomalieApiRow) {
  const kind = row.kind
  if (kind === 'fattura_duplicata' || kind === 'bolla_duplicata') {
    if (row.meta?.duplicateRole === 'canonical') {
      return 'border-emerald-500/35 bg-emerald-500/12 text-emerald-100'
    }
    return 'border-rose-500/40 bg-rose-500/15 text-rose-100'
  }
  if (kind === 'prezzo_listino') return 'border-amber-500/35 bg-amber-500/12 text-amber-100'
  if (kind === 'estratto_conto') return 'border-cyan-500/35 bg-cyan-500/10 text-cyan-100'
  if (kind === 'fornitore_stesso_dominio') return 'border-violet-500/40 bg-violet-500/15 text-violet-100'
  return 'border-app-line-30 bg-app-line-10 text-app-fg-muted'
}

export default function FornitoreAnomalieTab({
  fornitoreId,
  dateFrom,
  dateToExclusive,
  pathname,
  searchParams,
  onNavigateTab,
  currency = 'GBP',
  countryCode = 'UK',
  epoch = 0,
}: {
  fornitoreId: string
  dateFrom: string
  dateToExclusive: string
  pathname: string
  searchParams: ReadonlyURLSearchParams
  onNavigateTab: (tab: TabTarget) => void
  currency?: string
  countryCode?: string
  epoch?: number
}) {
  const t = useT()
  const { locale, timezone } = useLocale()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SupplierAnomalieApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  const formatDate = useCallback(
    (iso: string | null) =>
      iso
        ? formatDateLib(iso, locale, timezone, { day: '2-digit', month: 'short', year: 'numeric' })
        : '—',
    [locale, timezone],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = new URLSearchParams({
        fornitore_id: fornitoreId,
        from: dateFrom,
        to: dateToExclusive,
        country: countryCode,
      })
      const res = await fetch(`/api/fornitori/${encodeURIComponent(fornitoreId)}/anomalie?${q}`, {
        cache: 'no-store',
        credentials: 'include',
      })
      const j = (await res.json().catch(() => ({}))) as SupplierAnomalieApiResponse & { error?: string }
      if (!res.ok) {
        setError(j.error ?? `HTTP ${res.status}`)
        setData(null)
        return
      }
      setData(j)
    } catch {
      setError(t.ui.networkError)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateToExclusive, fornitoreId, countryCode, t.ui.networkError])

  useEffect(() => {
    void load()
  }, [load, epoch])

  const sortedRows = useMemo(() => {
    if (!data?.rows.length) return []
    return [...data.rows]
  }, [data])

  const resolvePriceAnomaly = async (anomalyId: string) => {
    const rawId = anomalyId.replace(/^pl-/, '')
    setResolvingId(anomalyId)
    const supabase = createClient()
    await supabase
      .from('price_anomalies')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', rawId)
    setResolvingId(null)
    void load()
  }

  const openDetail = (row: SupplierAnomalieApiRow) => {
    if (row.meta?.fatturaId) {
      router.push(fornitoreFatturaDeepLink(pathname, searchParams, row.meta.fatturaId), { scroll: false })
      return
    }
    if (row.meta?.bollaId) {
      router.push(fornitoreBollaDeepLink(pathname, searchParams, row.meta.bollaId), { scroll: false })
      return
    }
    if (row.kind === 'estratto_conto') onNavigateTab('verifica')
    else if (row.kind === 'documento_coda') onNavigateTab('documenti')
    else if (row.kind === 'prezzo_listino' || row.id === 'rekki-summary') onNavigateTab('listino')
    else if (row.kind === 'bolla_duplicata' || row.kind === 'bolla_aperta') onNavigateTab('bolle')
    else if (row.kind === 'fattura_duplicata') onNavigateTab('fatture')
  }

  const renderAttachment = (row: SupplierAnomalieApiRow) => {
    const url = row.fileUrl?.trim()
    if (!url) return <span className="text-xs text-app-fg-muted">—</span>
    const kind = attachmentKindFromFileUrl(url)
    return (
      <span className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">
        {kind === 'pdf'
          ? t.bolle.attachmentKindPdf
          : kind === 'image'
            ? t.bolle.attachmentKindImage
            : t.bolle.attachmentKindOther}
      </span>
    )
  }

  const renderRowActions = (row: SupplierAnomalieApiRow) => {
    const docItem = documentActionItemFromAnomalieRow(row, fornitoreId, '')
    return (
    <div className="flex w-full flex-nowrap items-center justify-end gap-1.5 md:inline-flex md:w-auto">
      {docItem ? (
        <DocumentRowActions
          item={docItem}
          fileUrl={row.fileUrl}
          fornitoreId={fornitoreId}
          iconOnly
          className="inline-flex shrink-0 items-center gap-1"
        />
      ) : null}
      {row.kind === 'prezzo_listino' && row.id.startsWith('pl-') && row.id !== 'rekki-summary' ? (
        <button
          type="button"
          disabled={resolvingId === row.id}
          onClick={() => void resolvePriceAnomaly(row.id)}
          className="w-full rounded-lg border border-app-line-30 px-2 py-1 text-[11px] font-semibold text-app-fg-muted hover:bg-app-line-15 md:w-auto"
        >
          {resolvingId === row.id ? '…' : t.fornitori.anomalieRisolvi}
        </button>
      ) : null}
      {row.meta?.fatturaId || row.meta?.bollaId ? (
        <button
          type="button"
          onClick={() => openDetail(row)}
          className="w-full rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-200 md:w-auto"
        >
          {t.common.detail}
        </button>
      ) : row.kind === 'documento_coda' ? (
        <Link
          href={fornitoreDocumentiQueueHref(pathname, searchParams, 'tutti')}
          className="inline-flex w-full shrink-0 items-center rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-cyan-200 md:w-auto"
        >
          {t.fornitori.anomalieApriCoda}
        </Link>
      ) : row.kind === 'fornitore_stesso_dominio' && row.meta?.peerFornitoreId ? (
        <Link
          href={`/fornitori/${encodeURIComponent(fornitoreId)}/edit?merge_source=${encodeURIComponent(row.meta.peerFornitoreId)}`}
          className="w-full rounded-lg border border-violet-500/40 bg-violet-500/15 px-2 py-1 text-[11px] font-semibold text-violet-100 md:w-auto"
        >
          {t.fornitori.anomalieUnisciFornitore}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => openDetail(row)}
          className="rounded-lg border border-app-line-30 px-2 py-1 text-[11px] font-semibold text-app-fg-muted hover:bg-app-line-15"
        >
          {t.common.detail}
        </button>
      )}
    </div>
    )
  }

  const hi = SUPPLIER_DETAIL_TAB_HIGHLIGHT.anomalie

  if (loading) {
    return (
      <div className="supplier-detail-tab-shell overflow-hidden">
        <div className={`app-card-bar-accent ${hi.bar}`} aria-hidden />
        <div className={APP_SECTION_DIVIDE_ROWS}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex animate-pulse gap-4 px-5 py-3.5">
              <div className="h-4 w-40 rounded app-workspace-inset-bg" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="supplier-detail-tab-shell overflow-hidden">
        <div className={`app-card-bar-accent ${hi.bar}`} aria-hidden />
        <AppSectionEmptyState message={error} />
      </div>
    )
  }

  if (!data || data.summary.total === 0) {
    return (
      <div className="supplier-detail-tab-shell overflow-hidden">
        <div className={`app-card-bar-accent ${hi.bar}`} aria-hidden />
        <AppSectionEmptyState
          message={t.fornitori.anomalieTabEmpty}
          subtitle={t.fornitori.anomalieTabEmptyHint}
        />
      </div>
    )
  }

  const summaryChips = [
    { label: t.fornitori.anomalieChipPrezzo, n: data.summary.prezzoListino + (data.summary.rekki > 0 ? 1 : 0) },
    { label: t.fornitori.anomalieChipFatture, n: data.summary.fattureDuplicati },
    { label: t.fornitori.anomalieChipBolle, n: data.summary.bolleDuplicati },
    { label: t.fornitori.anomalieChipEstratti, n: data.summary.estrattiConto },
    { label: t.fornitori.anomalieChipCoda, n: data.summary.documentiInCoda },
    { label: t.fornitori.anomalieChipStessoDominio, n: data.summary.fornitoriStessoDominio ?? 0 },
  ].filter((c) => c.n > 0)

  return (
    <div className="supplier-detail-tab-shell flex min-h-[min(420px,60vh)] flex-col overflow-hidden">
      <div className={`app-card-bar-accent ${hi.bar}`} aria-hidden />
      <div className="shrink-0 border-b border-app-line-22/80 px-4 py-3 md:px-5">
        <p className="text-sm font-semibold text-app-fg">{t.fornitori.anomalieTabTitle}</p>
        <p className="mt-0.5 text-xs text-app-fg-muted">{t.fornitori.anomalieTabSubtitle}</p>
        {summaryChips.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {summaryChips.map((c) => (
              <span
                key={c.label}
                className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-100"
              >
                {c.n} {c.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={SUPPLIER_LEDGER_TABLE_WRAP}>
          <table className={`${SUPPLIER_LEDGER_TABLE} min-w-[52rem]`}>
            <thead className={APP_SECTION_TABLE_THEAD_STICKY}>
              <tr className={supplierLedgerTableHeadRow('anomalie')}>
                <th className={`w-[1%] whitespace-nowrap ${SUPPLIER_LEDGER_TH}`}>
                  {t.common.date}
                </th>
                <th className={`min-w-[9.5rem] ${SUPPLIER_LEDGER_TH}`}>
                  {t.fornitori.anomalieColIssue}
                </th>
                <th className={`min-w-[10rem] ${SUPPLIER_LEDGER_TH}`}>
                  {t.fornitori.anomalieColDocument}
                </th>
                <th className={`w-[1%] whitespace-nowrap ${SUPPLIER_LEDGER_TH}`}>
                  {t.bolle.colAttachmentKind}
                </th>
                <th className={`w-[1%] whitespace-nowrap ${SUPPLIER_LEDGER_TH_AMOUNT}`}>
                  {t.statements.colAmount}
                </th>
                <th className={`w-[1%] whitespace-nowrap ${SUPPLIER_LEDGER_TH_RIGHT}`}>
                  {t.common.actions}
                </th>
              </tr>
            </thead>
            <tbody className={APP_SECTION_TABLE_TBODY}>
              {sortedRows.map((row) => {
                const regDateHint = registeredDateHint(row, t, formatDate)
                return (
                <tr key={row.id} className={APP_SECTION_TABLE_TR}>
                  <td className={`w-[1%] align-top whitespace-nowrap ${SUPPLIER_LEDGER_TD_DATE}`}>
                    {formatDate(row.data)}
                  </td>
                  <td className={`max-w-[14rem] align-top overflow-hidden ${SUPPLIER_LEDGER_TD}`}>
                    <span
                      className={`inline-flex max-w-full rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase leading-tight ${issueBadgeClass(row)}`}
                    >
                      {issueLabel(row, t, countryCode)}
                    </span>
                    {row.subtitle ? (
                      <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-app-fg-muted">{row.subtitle}</p>
                    ) : null}
                    {regDateHint ? (
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-amber-200/90">{regDateHint}</p>
                    ) : null}
                  </td>
                  <td className={`min-w-[10rem] max-w-[18rem] align-top overflow-hidden ${SUPPLIER_LEDGER_TD}`}>
                    <p className="truncate font-medium text-app-fg" title={row.title}>
                      {row.title}
                    </p>
                    {row.numero ? (
                      <p className="mt-0.5 truncate font-mono text-xs text-app-fg-muted" title={row.numero}>
                        {row.numero}
                      </p>
                    ) : null}
                  </td>
                  <td className={`w-[1%] align-top whitespace-nowrap ${SUPPLIER_LEDGER_TD}`}>{renderAttachment(row)}</td>
                  <td className={`w-[1%] align-top whitespace-nowrap ${SUPPLIER_LEDGER_TD_AMOUNT}`}>
                    {row.importo != null ? formatCurrency(row.importo, currency, locale) : '—'}
                  </td>
                  <td className={`w-[1%] align-top whitespace-nowrap ${SUPPLIER_LEDGER_TD_ACTIONS}`}>
                    {renderRowActions(row)}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>

        <div className={`md:hidden ${APP_SECTION_MOBILE_LIST}`}>
          {sortedRows.map((row) => {
            const regDateHint = registeredDateHint(row, t, formatDate)
            return (
            <div key={row.id} className="border-b border-app-line-22/50 px-4 py-3.5 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium tabular-nums text-app-fg">{formatDate(row.data)}</span>
                <span
                  className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${issueBadgeClass(row)}`}
                >
                  {issueLabel(row, t, countryCode)}
                </span>
              </div>
              <p className="mt-1.5 text-sm font-semibold text-app-fg">{row.title}</p>
              {row.subtitle ? <p className="mt-0.5 text-xs text-app-fg-muted">{row.subtitle}</p> : null}
              {regDateHint ? <p className="mt-0.5 text-xs text-amber-200/90">{regDateHint}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-app-fg-muted">
                {row.importo != null ? (
                  <span className="font-mono font-semibold tabular-nums text-app-fg">
                    {formatCurrency(row.importo, currency, locale)}
                  </span>
                ) : null}
                {renderAttachment(row)}
              </div>
              <div className="mt-2">{renderRowActions(row)}</div>
            </div>
          )})}
        </div>
      </div>
    </div>
  )
}
