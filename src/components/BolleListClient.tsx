'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Eye } from 'lucide-react'
import { useT } from '@/lib/use-t'
import { createClient } from '@/utils/supabase/client'
import { ReturnToLink } from '@/components/ReturnToLink'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import DeleteButton from '@/components/DeleteButton'
import { StandardBadge } from '@/components/ui/StandardBadge'
import { DuplicateLedgerRowExtras } from '@/components/DuplicateLedgerRowExtras'
import { fornitoreDisplayLabel } from '@/lib/fornitore-display'
import { tipoDocumentoToLabelStrict, extractDocTypeLabel } from '@/lib/extract-doc-type'
import { useContextMenu } from '@/components/ui/ContextMenuProvider'
import { AiAnalysisModal } from '@/components/AiAnalysisModal'
import { deleteDuplicateRow } from '@/lib/duplicate-invoice-actions'
import DocumentActionsButton from '@/components/DocumentActionsButton'
import {
  APP_SECTION_MOBILE_LIST,
  APP_SECTION_MOBILE_ROW,
  APP_SECTION_TABLE_CELL_LINK,
  APP_SECTION_TABLE_TD_COMPACT,
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_TR_GROUP,
  APP_SECTION_TABLE_THEAD_STICKY,
  APP_SECTION_TABLE_TH,
  APP_SECTION_TABLE_TH_RIGHT,
  appSectionTableHeadRowAccentClass,
} from '@/lib/app-shell-layout'
import type { FatturaDuplicateDeletionPayload } from '@/lib/check-duplicates'

type BollaListRow = {
  id: string
  data: string
  dateLabel: string
  stato: string
  file_url: string | null
  fornitore_id: string
  numero_bolla?: string | null
  fornitori?: { nome: string; display_name?: string | null } | null
  email_sync_auto_saved_at?: string | null
}

function daysBetweenIsoCalendarDates(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd.slice(0, 10)}T12:00:00`)
  const b = Date.parse(`${toYmd.slice(0, 10)}T12:00:00`)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.floor((b - a) / 86_400_000)
}

export default function BolleListClient({
  bolle,
  todayYmd,
  bolleReturn,
  excessBollaIds: excessBollaIdList,
  dupPayload,
}: {
  bolle: BollaListRow[]
  todayYmd: string
  bolleReturn: string
  excessBollaIds: string[]
  dupPayload: FatturaDuplicateDeletionPayload
}) {
  const t = useT()
  const router = useRouter()
  const supabase = createClient()
  const { show: showContextMenu } = useContextMenu()

  const excessBollaIds = useMemo(() => new Set(excessBollaIdList), [excessBollaIdList])

  const [aiAnalysisForBolla, setAiAnalysisForBolla] = useState<BollaListRow | null>(null)
  const [tipoDocByFileUrl, setTipoDocByFileUrl] = useState<Record<string, string>>({})
  const fetchedUrlsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const handler = () => router.refresh()
    window.addEventListener('bolla-mutated', handler)
    return () => window.removeEventListener('bolla-mutated', handler)
  }, [router])

  useEffect(() => {
    const urls = [...new Set(bolle.filter((b) => b.file_url?.trim()).map((b) => b.file_url!.trim()))]
    const newUrls = urls.filter((u) => !fetchedUrlsRef.current.has(u))
    if (!newUrls.length) return
    for (const u of newUrls) fetchedUrlsRef.current.add(u)
    let cancelled = false
    void (async () => {
      const { data: docs } = await supabase
        .from('documenti_da_processare')
        .select('file_url, metadata, file_name, oggetto_mail')
        .in('file_url', newUrls)
      if (cancelled || !docs?.length) return
      const map: Record<string, string> = {}
      for (const row of docs) {
        const fu = row.file_url?.trim()
        if (!fu) continue
        // Strict variant: always surface the OCR-detected type (including
        // 'fattura' / 'bolla_ddt') so the user can spot rows landed in the
        // wrong tab (e.g. an Invoice mistakenly saved under Bolle).
        const label = tipoDocumentoToLabelStrict((row.metadata as Record<string, unknown> | null)?.tipo_documento)
        if (label) {
          map[fu] = label
        } else {
          // Fallback: infer the type from the original file name / email subject
          // (storage URLs are hashed and rarely contain meaningful keywords).
          const inferred = extractDocTypeLabel(
            (row as { file_name?: string | null }).file_name ?? null,
            (row as { oggetto_mail?: string | null }).oggetto_mail ?? null,
          )
          if (inferred) map[fu] = inferred
        }
      }
      if (Object.keys(map).length) setTipoDocByFileUrl((prev) => ({ ...prev, ...map }))
    })()
    return () => { cancelled = true }
  }, [bolle, supabase])

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, b: BollaListRow) => {
      e.preventDefault()

      const items: Parameters<typeof showContextMenu>[0]['items'] = []

      items.push({
        key: 'open-detail',
        label: t.bolle.contextMenuOpenDetail,
        onClick: () => router.push(`/bolle/${b.id}`),
      })

      if (b.file_url) {
        items.push({
          key: 'open-attachment',
          label: t.bolle.contextMenuOpenAttachment,
          onClick: () => {
            window.open(
              `/api/open-document?bolla_id=${b.id}`,
              '_blank',
              'noopener,noreferrer',
            )
          },
        })
      }

      items.push({
        key: 'ai-analysis',
        label: t.bolle.contextMenuAiAnalysis,
        onClick: () => setAiAnalysisForBolla(b),
      })

      if (b.stato === 'in attesa') {
        items.push({
          key: 'upload-invoice',
          label: t.bolle.contextMenuUploadInvoice,
          onClick: () =>
            router.push(
              `/fatture/new?bolla_id=${b.id}&fornitore_id=${b.fornitore_id}`,
            ),
        })
      }

      if (!excessBollaIds.has(b.id)) {
        items.push({
          key: 'delete',
          label: t.bolle.contextMenuDelete,
          danger: true,
          onClick: () => {
            const msg = t.bolle.deleteConfirm
            if (window.confirm(msg)) {
              void deleteDuplicateRow(supabase, 'bolle', b.id).then(({ error }) => {
                if (!error) router.refresh()
              })
            }
          },
        })
      }

      showContextMenu({ x: e.clientX, y: e.clientY, items })
    },
    [t, router, supabase, showContextMenu, excessBollaIds],
  )

  return (
    <>
      <div className={APP_SECTION_MOBILE_LIST}>
        {bolle.map((b) => {
          const supplierLabel = b.fornitori ? fornitoreDisplayLabel(b.fornitori) : ''
          const overdueInv =
            b.stato === 'in attesa' && daysBetweenIsoCalendarDates(b.data, todayYmd) > 7
          return (
            <div
              key={b.id}
              className={APP_SECTION_MOBILE_ROW}
              onContextMenu={(e) => handleContextMenu(e, b)}
            >
              <ReturnToLink to={`/bolle/${b.id}`} from={bolleReturn} className="mb-3 block text-left transition-colors hover:opacity-90">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p
                      className={`truncate font-semibold ${overdueInv ? 'text-amber-200' : 'text-app-fg'}`}
                    >
                      {supplierLabel || <span className="text-app-fg-muted">—</span>}
                    </p>
                    <p className={`mt-0.5 text-xs ${overdueInv ? 'text-amber-200/90' : 'text-app-fg-muted'}`}>
                      {b.dateLabel}
                    </p>
                    <p className="mt-1 text-[11px] text-app-fg-muted">
                      <span className="font-semibold uppercase tracking-wide text-app-fg-muted">
                        {t.bolle.colNumero}
                      </span>{' '}
                      <span className={`font-mono ${overdueInv ? 'text-amber-100' : 'text-app-fg'}`}>
                        {b.numero_bolla?.trim() || '—'}
                      </span>
                      {b.numero_bolla?.trim() && (
                        <span className="ml-1.5 font-sans text-[10px] font-normal opacity-60">
                          {(b.file_url ? tipoDocByFileUrl[b.file_url.trim()] : undefined) ?? extractDocTypeLabel(b.numero_bolla, b.file_url) ?? t.dashboard.emailSyncDocumentKindBolla}
                        </span>
                      )}
                      <DuplicateLedgerRowExtras
                        rowId={b.id}
                        payload={dupPayload}
                        kind="bolla"
                        duplicateBadgeLabel={t.common.duplicateBadge}
                        duplicateDeleteConfirm={t.bolle.duplicateCopyDeleteConfirm}
                        removeCopyLabel={t.fatture.duplicateRemoveThisCopy}
                        deleteFailedPrefix={t.appStrings.deleteFailed}
                      />
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {overdueInv ? (
                      <span
                        className="inline-flex text-amber-400"
                        title={t.bolle.pendingInvoiceOverdueHint}
                        aria-label={t.bolle.pendingInvoiceOverdueHint}
                      >
                        <AlertTriangle className="h-4 w-4" aria-hidden strokeWidth={2} />
                      </span>
                    ) : null}
                    {b.stato === 'completato' ? (
                      <StandardBadge variant="success" dot="emerald" className="shrink-0 normal-case">
                        {t.status.completato}
                      </StandardBadge>
                    ) : (
                      <StandardBadge variant="pending" dot="amber" className="shrink-0 normal-case">
                        {t.status.inAttesa}
                      </StandardBadge>
                    )}
                    {b.email_sync_auto_saved_at ? (
                      <span className="rounded-full bg-teal-500/22 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-teal-100 ring-1 ring-teal-400/35">
                        {t.common.emailSyncAutoSavedBadge}
                      </span>
                    ) : null}
                  </div>
                </div>
              </ReturnToLink>
              <div className="flex flex-wrap items-center gap-2">
                {b.file_url && (
                  <OpenDocumentInAppButton bollaId={b.id} fileUrl={b.file_url}>
                    <Eye className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
                    {t.bolle.viewDocument}
                  </OpenDocumentInAppButton>
                )}
                {!excessBollaIds.has(b.id) ? (
                  <DeleteButton id={b.id} table="bolle" confirmMessage={t.bolle.deleteConfirm} />
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <table className="hidden w-full text-sm min-[640px]:table">
        <thead className={APP_SECTION_TABLE_THEAD_STICKY}>
          <tr className={appSectionTableHeadRowAccentClass('violet')}>
            <th className={APP_SECTION_TABLE_TH}>{t.common.date}</th>
            <th className={APP_SECTION_TABLE_TH}>{t.bolle.colNumero}</th>
            <th className={APP_SECTION_TABLE_TH}>{t.common.supplier}</th>
            <th className={APP_SECTION_TABLE_TH}>{t.common.status}</th>
            <th className={APP_SECTION_TABLE_TH_RIGHT}>{t.common.actions}</th>
          </tr>
        </thead>
        <tbody className={APP_SECTION_TABLE_TBODY}>
          {bolle.map((b) => {
            const supplierLabel = b.fornitori ? fornitoreDisplayLabel(b.fornitori) : ''
            const overdueInv =
              b.stato === 'in attesa' && daysBetweenIsoCalendarDates(b.data, todayYmd) > 7
            return (
              <tr
                key={b.id}
                className={APP_SECTION_TABLE_TR_GROUP}
                onContextMenu={(e) => handleContextMenu(e, b)}
              >
                <td
                  className={`${APP_SECTION_TABLE_TD_COMPACT} whitespace-nowrap font-medium ${overdueInv ? 'text-amber-200' : 'text-app-fg-muted'}`}
                >
                  <ReturnToLink to={`/bolle/${b.id}`} from={bolleReturn} className={APP_SECTION_TABLE_CELL_LINK}>
                    {b.dateLabel}
                  </ReturnToLink>
                </td>
                <td className={`${APP_SECTION_TABLE_TD_COMPACT} max-w-[10rem] font-mono text-app-fg-muted`}>
                  <ReturnToLink
                    to={`/bolle/${b.id}`}
                    from={bolleReturn}
                    className={`${APP_SECTION_TABLE_CELL_LINK} ${overdueInv ? 'text-amber-100' : ''}`}
                  >
                    {b.numero_bolla?.trim() || '—'}
                  </ReturnToLink>
                  {b.numero_bolla?.trim() && (
                    <span className="mt-0.5 block font-sans text-[10px] font-normal not-italic text-app-fg-muted/60">
                      {(b.file_url ? tipoDocByFileUrl[b.file_url.trim()] : undefined) ?? extractDocTypeLabel(b.numero_bolla, b.file_url) ?? t.dashboard.emailSyncDocumentKindBolla}
                    </span>
                  )}
                  <DuplicateLedgerRowExtras
                    rowId={b.id}
                    payload={dupPayload}
                    kind="bolla"
                    duplicateBadgeLabel={t.common.duplicateBadge}
                    duplicateDeleteConfirm={t.bolle.duplicateCopyDeleteConfirm}
                    removeCopyLabel={t.fatture.duplicateRemoveThisCopy}
                    deleteFailedPrefix={t.appStrings.deleteFailed}
                  />
                </td>
                <td className={`${APP_SECTION_TABLE_TD_COMPACT} font-medium ${overdueInv ? 'text-amber-100' : 'text-app-fg'}`}>
                  <ReturnToLink to={`/bolle/${b.id}`} from={bolleReturn} className={APP_SECTION_TABLE_CELL_LINK}>
                    {supplierLabel || <span className="text-app-fg-muted">—</span>}
                  </ReturnToLink>
                </td>
                <td className={APP_SECTION_TABLE_TD_COMPACT}>
                  <div className="flex flex-wrap items-center gap-2">
                    {overdueInv ? (
                      <span
                        className="inline-flex text-amber-400"
                        title={t.bolle.pendingInvoiceOverdueHint}
                        aria-label={t.bolle.pendingInvoiceOverdueHint}
                      >
                        <AlertTriangle className="h-4 w-4" aria-hidden strokeWidth={2} />
                      </span>
                    ) : null}
                    {b.stato === 'completato' ? (
                      <StandardBadge variant="success" dot="emerald" className="normal-case">
                        {t.status.completato}
                      </StandardBadge>
                    ) : (
                      <StandardBadge variant="pending" dot="amber" className="normal-case">
                        {t.status.inAttesa}
                      </StandardBadge>
                    )}
                    {b.email_sync_auto_saved_at ? (
                      <span className="rounded-full bg-teal-500/22 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-teal-100 ring-1 ring-teal-400/35">
                        {t.common.emailSyncAutoSavedBadge}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className={APP_SECTION_TABLE_TD_COMPACT}>
                  <div className="flex flex-nowrap items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {b.file_url && (
                      <OpenDocumentInAppButton bollaId={b.id} fileUrl={b.file_url}>
                        <Eye className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
                        {t.bolle.viewDocument}
                      </OpenDocumentInAppButton>
                    )}
                    <DocumentActionsButton
                      item={{
                        id: b.id,
                        origine: 'bolla',
                        fornitore_id: b.fornitore_id ?? null,
                        fornitore_nome: b.fornitori?.display_name ?? b.fornitori?.nome ?? null,
                        numero_documento: b.numero_bolla ?? null,
                        file_url: b.file_url ?? null,
                        data_doc: b.data ?? null,
                      }}
                      className="h-7 w-7"
                    />
                    {!excessBollaIds.has(b.id) ? (
                      <DeleteButton id={b.id} table="bolle" confirmMessage={t.bolle.deleteConfirm} />
                    ) : null}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <AiAnalysisModal
        open={aiAnalysisForBolla !== null}
        onOpenChange={() => setAiAnalysisForBolla(null)}
        entityType="bolla"
        entityId={aiAnalysisForBolla?.id ?? ''}
        fornitoreId={aiAnalysisForBolla?.fornitore_id}
      />
    </>
  )
}
