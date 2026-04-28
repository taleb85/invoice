'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useT } from '@/lib/use-t'
import { deleteDuplicateInvoice } from '@/lib/duplicate-invoice-actions'
import DeleteButton from '@/components/DeleteButton'
import { OpenDocumentInAppButton } from '@/components/OpenDocumentInAppButton'
import type { FatturaDuplicateDeletionPayload } from '@/lib/check-duplicates'
import {
  APP_SECTION_AMOUNT_POSITIVE_CLASS,
  APP_SECTION_MOBILE_LIST,
  APP_SECTION_MOBILE_ROW,
  APP_SECTION_ROW_ACTION_CHIP,
  APP_SECTION_TABLE_CELL_LINK,
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_TD_NUMERIC,
  APP_SECTION_TABLE_TH,
  APP_SECTION_TABLE_TH_RIGHT,
  APP_SECTION_TABLE_TR,
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
  /** Impostato se la riga viene dalla scansione email OCR automatica */
  email_sync_auto_saved_at?: string | null
}

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
  const [focusedGroupKey, setFocusedGroupKey] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  const removeCopy = useCallback(
    async (row: FattureDuplicateListRow) => {
      const num = (row.numero_fattura ?? '').trim() || '—'
      const msg = t.fatture.duplicateDeleteConfirm.replace('{numero}', num)
      if (!window.confirm(msg)) return
      setDeletingId(row.id)
      const { error } = await deleteDuplicateInvoice(supabase, row.id)
      setDeletingId(null)
      if (error) {
        window.alert(`${t.appStrings.deleteFailed} ${error}`)
        return
      }
      setFocusedGroupKey(null)
      router.refresh()
    },
    [router, supabase, t.appStrings.deleteFailed, t.fatture.duplicateDeleteConfirm],
  )

  return (
    <>
      <div className={APP_SECTION_MOBILE_LIST}>
        {rows.map((f) => (
          <div
            key={f.id}
            className={`${APP_SECTION_MOBILE_ROW} ${highlightedIds.has(f.id) ? `${highlightRowCls} rounded-xl` : ''}`}
          >
              <div className="mb-2 flex items-start justify-between gap-2">
                {f.fornitore_id ? (
                  <Link href={`/fornitori/${f.fornitore_id}`} className={`truncate ${APP_SECTION_TABLE_CELL_LINK}`}>
                    {f.fornitoreNome ?? '—'}
                  </Link>
                ) : (
                  <p className="truncate font-semibold text-app-fg">{f.fornitoreNome ?? '—'}</p>
                )}
                <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                  <Link
                    href={`/fatture/${f.id}`}
                    className="text-xs text-app-fg-muted transition-colors hover:text-app-fg"
                  >
                    {f.dataLabel}
                  </Link>
                  {f.importoLabel ? (
                    <span className={`font-mono text-xs tabular-nums ${APP_SECTION_AMOUNT_POSITIVE_CLASS}`}>
                      {f.importoLabel}
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
                  <OpenDocumentInAppButton fatturaId={f.id} fileUrl={f.file_url}>
                    {t.fatture.apri}
                  </OpenDocumentInAppButton>
                </div>
              )}
          </div>
        ))}
      </div>

      <table className="hidden w-full text-sm md:table">
        <thead className={APP_SECTION_TABLE_THEAD_STICKY}>
          <tr className={appSectionTableHeadRowAccentClass('emerald')}>
            <th className={APP_SECTION_TABLE_TH}>{t.common.supplier}</th>
            <th className={APP_SECTION_TABLE_TH}>{t.common.date}</th>
            <th className={APP_SECTION_TABLE_TH}>{t.fatture.colNumFattura}</th>
            <th className={APP_SECTION_TABLE_TH}>{t.fatture.headerBolla}</th>
            <th className={APP_SECTION_TABLE_TH}>{t.fatture.headerAllegato}</th>
            <th className={APP_SECTION_TABLE_TH_RIGHT}>{t.statements.colAmount}</th>
            <th className={APP_SECTION_TABLE_TH} />
          </tr>
        </thead>
        <tbody className={APP_SECTION_TABLE_TBODY}>
          {rows.map((f) => (
            <tr key={f.id} className={`${APP_SECTION_TABLE_TR} ${highlightedIds.has(f.id) ? highlightRowCls : ''}`}>
              <td className="px-6 py-4">
                {f.fornitore_id ? (
                  <Link href={`/fornitori/${f.fornitore_id}`} className={APP_SECTION_TABLE_CELL_LINK}>
                    {f.fornitoreNome ?? '—'}
                  </Link>
                ) : (
                  <Link href={`/fatture/${f.id}`} className={APP_SECTION_TABLE_CELL_LINK}>
                    {f.fornitoreNome ?? '—'}
                  </Link>
                )}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-app-fg-muted">{f.dataLabel}</td>
              <td className="max-w-[12rem] px-6 py-4 text-app-fg-muted">
                <span className="line-clamp-2 break-words" title={f.numero_fattura?.trim() || undefined}>
                  {f.numero_fattura?.trim() || '—'}
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
              <td className="px-6 py-4">
                {f.bolla_id ? (
                  <Link href={`/bolle/${f.bolla_id}`} className={`text-xs ${APP_SECTION_TABLE_CELL_LINK} hover:underline`}>
                    {t.fatture.openBill}
                  </Link>
                ) : (
                  <span className="text-xs text-app-fg-muted">—</span>
                )}
              </td>
              <td className="px-6 py-4">
                {f.file_url ? (
                  <OpenDocumentInAppButton fatturaId={f.id} fileUrl={f.file_url}>
                    {t.fatture.apri}
                  </OpenDocumentInAppButton>
                ) : (
                  <span className="text-xs text-app-fg-muted">—</span>
                )}
              </td>
              <td
                className={
                  f.importoLabel
                    ? `${APP_SECTION_TABLE_TD_NUMERIC} ${APP_SECTION_AMOUNT_POSITIVE_CLASS}`
                    : `${APP_SECTION_TABLE_TD_NUMERIC} text-app-fg-muted`
                }
              >
                <div className="flex flex-col items-end gap-1">
                  <span>{f.importoLabel ?? '—'}</span>
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
              <td className="px-6 py-4 text-right">
                <DeleteButton id={f.id} table="fatture" confirmMessage={t.fatture.deleteConfirm} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
