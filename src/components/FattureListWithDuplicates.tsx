'use client'
'use no memo'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useT } from '@/lib/use-t'
import { useToast } from '@/lib/toast-context'
import { deleteDuplicateRow } from '@/lib/duplicate-invoice-actions'
import DeleteButton from '@/components/DeleteButton'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import { useContextMenu } from '@/components/ui/ContextMenuProvider'
import { AiAnalysisModal } from '@/components/AiAnalysisModal'
import DocumentActionsButton from '@/components/DocumentActionsButton'
import type { FatturaDuplicateDeletionPayload } from '@/lib/check-duplicates'
import {
  APP_SECTION_AMOUNT_POSITIVE_CLASS,
  APP_SECTION_MOBILE_LIST,
  APP_SECTION_MOBILE_ROW,
  APP_SECTION_ROW_ACTION_CHIP,
  APP_SECTION_TABLE_CELL_LINK,
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_TD_COMPACT,
  APP_SECTION_TABLE_TH,
  APP_SECTION_TABLE_TH_RIGHT,
  APP_SECTION_TABLE_TR_GROUP,
  APP_SECTION_TABLE_THEAD_STICKY,
  appSectionTableHeadRowAccentClass,
} from '@/lib/app-shell-layout'
import { standardBadgeClassName } from '@/components/ui/StandardBadge'
import { ActionButton } from '@/components/ui/ActionButton'
import { ApprovalBadge } from '@/components/approval/approval-badge'

export type FattureDuplicateListRow = {
  id: string
  dataLabel: string
  numero_fattura: string | null
  file_url: string | null
  bolla_id: string | null
  fornitore_id: string | null
  fornitoreNome: string | null
  importoLabel: string | null
  approval_status?: string | null
  rejection_reason?: string | null
  /** Etichetta già formattata lato server: data creazione/modifica (DD/MM/YYYY HH:MM) */
  dataDocumentoLabel?: string | null
  /** ISO grezzo per tooltip / ordinamento */
  dataDocumentoFull?: string | null
  /** Etichetta già formattata lato server: data sincronizzazione (DD/MM/YYYY HH:MM:SS) */
  dataSincronizzazioneLabel?: string | null
  /** ISO grezzo per tooltip / ordinamento */
  dataSincronizzazioneFull?: string | null
  /** Impostato se la riga viene dalla scansione email OCR automatica */
  email_sync_auto_saved_at?: string | null
  is_credit_note?: boolean
}

type SortKey = 'dataDocumento' | 'dataSincronizzazione'
type SortDir = 'asc' | 'desc'

const dupBadgeInteractiveCls = standardBadgeClassName(
  'duplicate',
  'ml-1.5 cursor-pointer align-middle transition-colors hover:border-[rgba(34,211,238,0.15)] hover:bg-red-900/55 focus:outline-none focus:ring-2 focus:ring-red-400/60',
)

const highlightRowCls = 'ring-2 ring-red-400/75 ring-offset-2 ring-offset-transparent'

function groupKeyForRowId(
  rowId: string,
  payload: FatturaDuplicateDeletionPayload,
): string | null {
  for (const [k, ids] of Object.entries(payload.groupMembers)) {
    if (ids.includes(rowId)) return k
  }
  return null
}

function SortIcon({ dir }: { dir: SortDir | null }) {
  if (dir === 'asc') {
    return (
      <svg className="ml-1 inline-block h-3 w-3 align-middle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
      </svg>
    )
  }
  if (dir === 'desc') {
    return (
      <svg className="ml-1 inline-block h-3 w-3 align-middle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      </svg>
    )
  }
  return (
    <svg className="ml-1 inline-block h-3 w-3 align-middle opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
    </svg>
  )
}

export default function FattureListWithDuplicates({
  rows,
  duplicatePayload,
}: {
  rows: FattureDuplicateListRow[]
  duplicatePayload: FatturaDuplicateDeletionPayload
}) {
  const t = useT()
  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()
  const [focusedGroupKey, setFocusedGroupKey] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [aiAnalysisForFattura, setAiAnalysisForFattura] =
    useState<FattureDuplicateListRow | null>(null)
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const { show: showContextMenu } = useContextMenu()

  useEffect(() => {
    const handler = () => router.refresh()
    window.addEventListener('document-type-changed', handler)
    window.addEventListener('fattura-mutated', handler)
    return () => {
      window.removeEventListener('document-type-changed', handler)
      window.removeEventListener('fattura-mutated', handler)
    }
  }, [router])

  const excessSet = useMemo(() => new Set(duplicatePayload.excessIds), [duplicatePayload.excessIds])
  const memberSet = useMemo(() => new Set(duplicatePayload.memberIds), [duplicatePayload.memberIds])

  const highlightedIds = useMemo(() => {
    if (!focusedGroupKey) return new Set<string>()
    return new Set(duplicatePayload.groupMembers[focusedGroupKey] ?? [])
  }, [focusedGroupKey, duplicatePayload.groupMembers])

  const toggleBadgeFocus = useCallback(
    (rowId: string) => {
      const gk = groupKeyForRowId(rowId, duplicatePayload)
      if (!gk) return
      setFocusedGroupKey((prev) => (prev === gk ? null : gk))
    },
    [duplicatePayload],
  )

  const handleSort = useCallback(
    (key: SortKey) => {
      setSortKey((prev) => {
        if (prev === key) {
          setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
          return key
        }
        setSortDir('desc')
        return key
      })
    },
    [],
  )

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) => {
      const aVal = sortKey === 'dataDocumento' ? a.dataDocumentoFull : a.dataSincronizzazioneFull
      const bVal = sortKey === 'dataDocumento' ? b.dataDocumentoFull : b.dataSincronizzazioneFull
      if (!aVal && !bVal) return 0
      if (!aVal) return 1
      if (!bVal) return -1
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortKey, sortDir])

  const removeCopy = useCallback(
    async (row: FattureDuplicateListRow) => {
      const num = (row.numero_fattura ?? '').trim() || '—'
      const msg = t.fatture.duplicateDeleteConfirm.replace('{numero}', num)
      if (!window.confirm(msg)) return
      setDeletingId(row.id)
      const { error } = await deleteDuplicateRow(supabase, 'fatture', row.id)
      setDeletingId(null)
      if (error) {
        showToast(`${t.appStrings.deleteFailed} ${error}`, 'error')
        return
      }
      setFocusedGroupKey(null)
      router.refresh()
    },
    [router, supabase, showToast, t.appStrings.deleteFailed, t.fatture.duplicateDeleteConfirm],
  )

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, row: FattureDuplicateListRow) => {
      e.preventDefault()
      const items: Parameters<typeof showContextMenu>[0]['items'] = []

      items.push({
        key: 'ai-analysis',
        label: t.fatture.contextMenuAiAnalysis,
        onClick: () => setAiAnalysisForFattura(row),
      })

      items.push({
        key: 'open-detail',
        label: t.fatture.contextMenuOpenDetail,
        onClick: () => router.push(`/fatture/${row.id}`),
      })

      if (row.file_url) {
        items.push({
          key: 'open-attachment',
          label: t.fatture.contextMenuOpenAttachment,
          onClick: () => {
            window.open(
              `/api/open-document?fattura_id=${row.id}`,
              '_blank',
              'noopener,noreferrer',
            )
          },
        })
      }

      items.push({
        key: 'assign-supplier',
        label: t.fatture.contextMenuAssignSupplier,
        onClick: () => router.push(`/fatture/${row.id}`),
      })

      items.push({
        key: 'not-invoice',
        label: t.fatture.contextMenuNotAnInvoice,
        danger: true,
        onClick: () => {
          const msg = t.fatture.deleteConfirm
          if (window.confirm(msg)) {
            void deleteDuplicateRow(supabase, 'fatture', row.id).then(({ error }) => {
              if (!error) router.refresh()
            })
          }
        },
      })

      showContextMenu({ x: e.clientX, y: e.clientY, items })
    },
    [t, router, supabase, showContextMenu],
  )

  function extendedDateTime(iso: string | null | undefined): string | null {
    if (!iso) return null
    try {
      return new Intl.DateTimeFormat('it-IT', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short',
      }).format(new Date(iso))
    } catch {
      return null
    }
  }

  return (
    <>
      <div className={APP_SECTION_MOBILE_LIST}>
        {sortedRows.map((f) => (
          <div
            key={f.id}
            className={`${APP_SECTION_MOBILE_ROW} ${highlightedIds.has(f.id) ? `${highlightRowCls} rounded-xl` : ''}`}
            onContextMenu={(e) => handleContextMenu(e, f)}
          >
              <div className="mb-2 flex items-start justify-between gap-2">
                {f.fornitore_id ? (
                  <Link href={`/fornitori/${f.fornitore_id}`} className={`truncate ${APP_SECTION_TABLE_CELL_LINK}`} title={f.fornitoreNome && f.fornitoreNome.length > 50 ? f.fornitoreNome : undefined}>
                    {f.fornitoreNome && f.fornitoreNome.length > 50 ? `${f.fornitoreNome.substring(0, 50)}…` : f.fornitoreNome ?? '—'}
                  </Link>
                ) : (
                  <p className="truncate font-semibold text-app-fg" title={f.fornitoreNome && f.fornitoreNome.length > 50 ? f.fornitoreNome : undefined}>{f.fornitoreNome && f.fornitoreNome.length > 50 ? `${f.fornitoreNome.substring(0, 50)}…` : f.fornitoreNome ?? '—'}</p>
                )}
                <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                  {f.importoLabel ? (
                    <span className={`font-mono text-xs tabular-nums ${APP_SECTION_AMOUNT_POSITIVE_CLASS}`}>
                      {f.importoLabel}
                    </span>
                  ) : null}
                  {f.is_credit_note ? (
                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200 ring-1 ring-amber-500/35">
                      Credit Note
                    </span>
                  ) : null}
                  {f.approval_status && f.approval_status !== 'approved' && (
                    <ApprovalBadge
                      status={f.approval_status as 'pending' | 'approved' | 'rejected'}
                      rejectionReason={f.rejection_reason}
                      size="sm"
                    />
                  )}
                  {f.email_sync_auto_saved_at ? (
                    <span className="rounded-full bg-teal-500/22 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-teal-100 ring-1 ring-teal-400/35">
                      {t.common.emailSyncAutoSavedBadge}
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="mb-2 text-xs text-app-fg-muted">
                <span className="font-medium text-app-fg-muted">{t.fatture.colNumFattura}</span>{' '}
                <span className="text-app-fg-muted">{f.numero_fattura?.trim() || '—'}</span>
                {f.numero_fattura?.trim() && (
                  <span className="ml-1.5 font-sans text-[10px] font-normal opacity-60">
                    {f.is_credit_note ? 'Credit Note' : 'Invoice'}
                  </span>
                )}
                {memberSet.has(f.id) ? (
                  <button
                    type="button"
                    className={dupBadgeInteractiveCls}
                    aria-label={t.fatture.duplicatePairBadgeAria}
                    aria-pressed={focusedGroupKey != null && highlightedIds.has(f.id)}
                    onClick={() => toggleBadgeFocus(f.id)}
                  >
                    {t.common.duplicateBadge}
                  </button>
                ) : null}
              </p>
              {(f.dataDocumentoLabel || f.dataSincronizzazioneLabel) && (
                <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-app-fg-muted">
                  {f.dataDocumentoLabel && (
                    <span>
                      <span className="font-medium uppercase tracking-wide">{t.fatture.colDataDoc}</span>{' '}
                      {f.dataDocumentoLabel}
                    </span>
                  )}
                  {f.dataSincronizzazioneLabel && (
                    <span title={extendedDateTime(f.dataSincronizzazioneFull) ?? undefined}>
                      <span className="font-medium uppercase tracking-wide">{t.fatture.colDataSync}</span>{' '}
                      {f.dataSincronizzazioneLabel}
                    </span>
                  )}
                </div>
              )}
              {excessSet.has(f.id) ? (
                <ActionButton
                  type="button"
                  intent="danger"
                  size="sm"
                  className="mt-1.5"
                  disabled={deletingId === f.id}
                  onClick={() => void removeCopy(f)}
                >
                  {focusedGroupKey && highlightedIds.has(f.id)
                    ? t.fatture.duplicateRemoveThisCopy
                    : t.fatture.duplicateRemoveCopy}
                </ActionButton>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {f.bolla_id && (
                  <Link href={`/bolle/${f.bolla_id}`} className={APP_SECTION_ROW_ACTION_CHIP}>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
                      />
                    </svg>
                    {t.fatture.openBill}
                  </Link>
                )}
              </div>
              {f.file_url && (
                <div className="mt-2">
                  <OpenDocumentInAppButton
                    fatturaId={f.id}
                    fileUrl={f.file_url}
                    title={t.common.openAttachment}
                  >
                    {t.common.openAttachment}
                  </OpenDocumentInAppButton>
                </div>
              )}
          </div>
        ))}
      </div>

      <table className="hidden min-[640px]:table w-full text-sm">
        <thead className={APP_SECTION_TABLE_THEAD_STICKY}>
          <tr className={appSectionTableHeadRowAccentClass('emerald')}>
            <th className={APP_SECTION_TABLE_TH}>{t.common.supplier}</th>
            <th className={APP_SECTION_TABLE_TH}>
              <button
                type="button"
                onClick={() => handleSort('dataDocumento')}
                className="inline-flex items-center gap-0.5 uppercase tracking-[1.5px] text-app-fg-muted transition-colors hover:text-app-fg"
              >
                {t.fatture.colDataDoc}
                <SortIcon dir={sortKey === 'dataDocumento' ? sortDir : null} />
              </button>
            </th>
            <th className={APP_SECTION_TABLE_TH}>
              <button
                type="button"
                onClick={() => handleSort('dataSincronizzazione')}
                className="inline-flex items-center gap-0.5 uppercase tracking-[1.5px] text-app-fg-muted transition-colors hover:text-app-fg"
              >
                {t.fatture.colDataSync}
                <SortIcon dir={sortKey === 'dataSincronizzazione' ? sortDir : null} />
              </button>
            </th>
            <th className={APP_SECTION_TABLE_TH}>{t.fatture.colNumFattura}</th>
            <th className={APP_SECTION_TABLE_TH}>{t.fatture.headerAllegato}</th>
            <th className={APP_SECTION_TABLE_TH_RIGHT}>{t.statements.colAmount}</th>
            <th className={APP_SECTION_TABLE_TH} />
          </tr>
        </thead>
        <tbody className={APP_SECTION_TABLE_TBODY}>
          {sortedRows.map((f) => (
            <tr key={f.id} className={`${APP_SECTION_TABLE_TR_GROUP} ${highlightedIds.has(f.id) ? highlightRowCls : ''}`} onContextMenu={(e) => handleContextMenu(e, f)}>
              <td className={APP_SECTION_TABLE_TD_COMPACT}>
                <span className="inline-flex items-baseline gap-1.5">
                  {f.fornitore_id ? (
                    <Link href={`/fornitori/${f.fornitore_id}`} className={APP_SECTION_TABLE_CELL_LINK} title={f.fornitoreNome && f.fornitoreNome.length > 50 ? f.fornitoreNome : undefined}>
                      {f.fornitoreNome && f.fornitoreNome.length > 50 ? `${f.fornitoreNome.substring(0, 50)}…` : f.fornitoreNome ?? '—'}
                    </Link>
                  ) : (
                    <span className="font-semibold text-app-fg" title={f.fornitoreNome && f.fornitoreNome.length > 50 ? f.fornitoreNome : undefined}>
                      {f.fornitoreNome && f.fornitoreNome.length > 50 ? `${f.fornitoreNome.substring(0, 50)}…` : f.fornitoreNome ?? '—'}
                    </span>
                  )}
                </span>
              </td>
              <td className={APP_SECTION_TABLE_TD_COMPACT}>
                {f.dataDocumentoLabel ? (
                  <span className="whitespace-nowrap text-app-fg-muted">
                    {f.dataDocumentoLabel}
                  </span>
                ) : (
                  <span className="text-app-fg-muted">—</span>
                )}
              </td>
              <td className={APP_SECTION_TABLE_TD_COMPACT}>
                {f.dataSincronizzazioneLabel ? (
                  <span
                    className="whitespace-nowrap text-app-fg-muted"
                    title={extendedDateTime(f.dataSincronizzazioneFull) ?? undefined}
                  >
                    {f.dataSincronizzazioneLabel}
                  </span>
                ) : (
                  <span className="text-app-fg-muted">—</span>
                )}
              </td>
              <td className={`${APP_SECTION_TABLE_TD_COMPACT} max-w-[11rem]`}>
                <span title={f.numero_fattura?.trim() || undefined}>
                  {f.numero_fattura?.trim() || '—'}
                  {f.numero_fattura?.trim() && (
                    <span className="mt-0.5 block font-sans text-[10px] font-normal not-italic text-app-fg-muted/60">
                      {f.is_credit_note ? 'Credit Note' : 'Invoice'}
                    </span>
                  )}
                  {memberSet.has(f.id) ? (
                    <button
                      type="button"
                      className={dupBadgeInteractiveCls}
                      aria-label={t.fatture.duplicatePairBadgeAria}
                      aria-pressed={focusedGroupKey != null && highlightedIds.has(f.id)}
                      onClick={() => toggleBadgeFocus(f.id)}
                    >
                      {t.common.duplicateBadge}
                    </button>
                  ) : null}
                </span>
                {excessSet.has(f.id) ? (
                  <div className="mt-1">
                    <ActionButton
                      type="button"
                      intent="danger"
                      size="sm"
                      disabled={deletingId === f.id}
                      onClick={() => void removeCopy(f)}
                    >
                      {focusedGroupKey && highlightedIds.has(f.id)
                        ? t.fatture.duplicateRemoveThisCopy
                        : t.fatture.duplicateRemoveCopy}
                    </ActionButton>
                  </div>
                ) : null}
              </td>
              <td className={APP_SECTION_TABLE_TD_COMPACT}>
                {f.file_url ? (
                  <OpenDocumentInAppButton
                    fatturaId={f.id}
                    fileUrl={f.file_url}
                    title={t.common.openAttachment}
                  >
                    {t.common.openAttachment}
                  </OpenDocumentInAppButton>
                ) : (
                  <span className="text-app-fg-muted">—</span>
                )}
              </td>
              <td
                className={`${APP_SECTION_TABLE_TD_COMPACT} text-right font-mono tabular-nums whitespace-nowrap ${
                  f.importoLabel
                    ? APP_SECTION_AMOUNT_POSITIVE_CLASS
                    : 'text-app-fg-muted'
                }`}
              >
                <div className="flex flex-col items-end gap-1">
                  <span>{f.importoLabel ?? '—'}</span>
                  {f.is_credit_note ? (
                    <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-200 ring-1 ring-amber-500/35">
                      Credit Note
                    </span>
                  ) : null}
                  {f.approval_status && f.approval_status !== 'approved' && (
                    <ApprovalBadge
                      status={f.approval_status as 'pending' | 'approved' | 'rejected'}
                      rejectionReason={f.rejection_reason}
                      size="sm"
                    />
                  )}
                  {f.email_sync_auto_saved_at ? (
                    <span className="rounded-full bg-teal-500/22 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-teal-100 ring-1 ring-teal-400/35">
                      {t.common.emailSyncAutoSavedBadge}
                    </span>
                  ) : null}
                </div>
              </td>
              <td className={`${APP_SECTION_TABLE_TD_COMPACT} text-right`}>
                <div className="flex flex-nowrap items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <DocumentActionsButton
                    item={{
                      id: f.id,
                      origine: 'fattura',
                      fornitore_id: f.fornitore_id ?? null,
                      fornitore_nome: f.fornitoreNome ?? null,
                      numero_documento: f.numero_fattura ?? null,
                      file_url: f.file_url ?? null,
                    }}
                    className="h-7 w-7"
                  />
                  <DeleteButton id={f.id} table="fatture" confirmMessage={t.fatture.deleteConfirm} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <AiAnalysisModal
        open={aiAnalysisForFattura !== null}
        onOpenChange={() => setAiAnalysisForFattura(null)}
        entityType="fattura"
        entityId={aiAnalysisForFattura?.id ?? ''}
      />
    </>
  )
}
