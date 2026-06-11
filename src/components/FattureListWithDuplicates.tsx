'use client'
'use no memo'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useT } from '@/lib/use-t'
import { useToast } from '@/lib/toast-context'
import { deleteDuplicateRow } from '@/lib/duplicate-invoice-actions'
import { DocumentRowActions } from '@/components/DocumentRowActions'
import { documentActionItemForFattura } from '@/lib/document-action-item'
import { attachmentKindFromFileUrl } from '@/lib/attachment-kind'
import { useContextMenu } from '@/components/ui/ContextMenuProvider'
import { AiAnalysisModal } from '@/components/AiAnalysisModal'
import type { FatturaDuplicateDeletionPayload } from '@/lib/check-duplicates'
import {
  APP_SECTION_AMOUNT_NEGATIVE_CLASS,
  APP_SECTION_AMOUNT_POSITIVE_CLASS,
  APP_SECTION_MOBILE_LIST,
  APP_SECTION_MOBILE_ROW,
  APP_SECTION_ROW_ACTION_CHIP,
  APP_SECTION_TABLE_CELL_LINK,
  APP_SECTION_TABLE_TBODY,
  APP_SECTION_TABLE_TR_GROUP,
  APP_SECTION_TABLE_THEAD_STICKY,
  appSectionTableHeadRowAccentClass,
} from '@/lib/app-shell-layout'
import { standardBadgeClassName } from '@/components/ui/StandardBadge'
import { ActionButton } from '@/components/ui/ActionButton'
import { ApprovalBadge } from '@/components/approval/approval-badge'
import { tipoDocumentoToLabel, extractDocTypeLabel } from '@/lib/extract-doc-type'

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

type SortKey = 'dataDocumento'
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
  const [tipoByFileUrl, setTipoByFileUrl] = useState<Record<string, string>>({})
  const tipoFetchedRef = useRef<Set<string>>(new Set())
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

  useEffect(() => {
    const urls = [...new Set(rows.filter((r) => r.file_url?.trim()).map((r) => r.file_url!.trim()))]
    const newUrls = urls.filter((u) => !tipoFetchedRef.current.has(u))
    if (!newUrls.length) return
    for (const u of newUrls) tipoFetchedRef.current.add(u)
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
        const label = tipoDocumentoToLabel((row.metadata as Record<string, unknown> | null)?.tipo_documento)
        if (label) {
          map[fu] = label
        } else {
          // Fallback: infer the type from the original file name / email subject
          const inferred = extractDocTypeLabel(
            (row as { file_name?: string | null }).file_name ?? null,
            (row as { oggetto_mail?: string | null }).oggetto_mail ?? null,
          )
          if (inferred) map[fu] = inferred
        }
      }
      if (Object.keys(map).length) setTipoByFileUrl((prev) => ({ ...prev, ...map }))
    })()
    return () => { cancelled = true }
  }, [rows, supabase])

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
      const aVal = a.dataDocumentoFull
      const bVal = b.dataDocumentoFull
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

  const fattureTableClass = 'hidden w-full min-w-0 table-fixed text-sm min-[640px]:table'
  const fattureTh =
    'px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted md:px-2.5 lg:py-2'
  const fattureThRight = `${fattureTh} text-right`
  const fattureTd = 'px-2 py-1.5 text-[13px] align-middle md:px-2.5 lg:py-2'
  const fattureTdNumero = `${fattureTd} pl-4 md:pl-5`
  const fattureThNumero = `${fattureTh} pl-4 md:pl-5`

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
                    <span className={`font-mono text-xs tabular-nums ${f.is_credit_note ? APP_SECTION_AMOUNT_NEGATIVE_CLASS : APP_SECTION_AMOUNT_POSITIVE_CLASS}`}>
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
                    {(f.file_url ? tipoByFileUrl[f.file_url.trim()] : undefined) ?? (f.is_credit_note ? 'Credit Note' : null) ?? extractDocTypeLabel(f.numero_fattura, f.file_url) ?? 'Invoice'}
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
              {f.dataDocumentoLabel ? (
                <div className="mb-2 text-[11px] text-app-fg-muted">
                  <span className="font-medium uppercase tracking-wide">{t.fatture.colDataDoc}</span>{' '}
                  {f.dataDocumentoLabel}
                </div>
              ) : null}
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
              {f.file_url ? (
                <div className="mt-2">
                  <DocumentRowActions
                    item={documentActionItemForFattura(
                      { ...f, sede_id: null, data: f.dataDocumentoFull ?? null, importo: null },
                      f.fornitore_id ?? '',
                      f.fornitoreNome ?? '',
                    )}
                    fileUrl={f.file_url}
                    fornitoreId={f.fornitore_id}
                  />
                </div>
              ) : null}
          </div>
        ))}
      </div>

      <table className={fattureTableClass}>
        <colgroup>
          <col className="w-[40%]" />
          <col className="w-[12%]" />
          <col className="w-[16%]" />
          <col className="w-[14%]" />
          <col className="w-[18%]" />
        </colgroup>
        <thead className={APP_SECTION_TABLE_THEAD_STICKY}>
          <tr className={appSectionTableHeadRowAccentClass('emerald')}>
            <th className={fattureTh}>{t.common.supplier}</th>
            <th className={fattureTh}>
              <button
                type="button"
                onClick={() => handleSort('dataDocumento')}
                className="inline-flex items-center gap-0.5 whitespace-nowrap text-left uppercase text-app-fg-muted transition-colors hover:text-app-fg"
              >
                {t.fatture.colDataDoc}
                <SortIcon dir={sortKey === 'dataDocumento' ? sortDir : null} />
              </button>
            </th>
            <th className={fattureThNumero}>{t.fatture.colNumFattura}</th>
            <th className={fattureThRight}>{t.statements.colAmount}</th>
            <th className={fattureThRight}>{t.common.actions}</th>
          </tr>
        </thead>
        <tbody className={APP_SECTION_TABLE_TBODY}>
          {sortedRows.map((f) => {
            const docKind =
              (f.file_url ? tipoByFileUrl[f.file_url.trim()] : undefined) ??
              (f.is_credit_note ? 'Credit Note' : null) ??
              extractDocTypeLabel(f.numero_fattura, f.file_url) ??
              'Invoice'
            const attachKind = f.file_url
              ? attachmentKindFromFileUrl(f.file_url) === 'pdf'
                ? t.bolle.attachmentKindPdf
                : attachmentKindFromFileUrl(f.file_url) === 'image'
                  ? t.bolle.attachmentKindImage
                  : t.bolle.attachmentKindOther
              : null

            return (
            <tr key={f.id} className={`${APP_SECTION_TABLE_TR_GROUP} ${highlightedIds.has(f.id) ? highlightRowCls : ''}`} onContextMenu={(e) => handleContextMenu(e, f)}>
              <td className={`${fattureTd} max-w-0`}>
                {f.fornitore_id ? (
                  <Link
                    href={`/fornitori/${f.fornitore_id}`}
                    className={`${APP_SECTION_TABLE_CELL_LINK} line-clamp-2 leading-snug`}
                    title={f.fornitoreNome ?? undefined}
                  >
                    {f.fornitoreNome ?? '—'}
                  </Link>
                ) : (
                  <span className="line-clamp-2 font-semibold leading-snug text-app-fg" title={f.fornitoreNome ?? undefined}>
                    {f.fornitoreNome ?? '—'}
                  </span>
                )}
              </td>
              <td className={`${fattureTd} whitespace-nowrap`}>
                <span className="text-app-fg-muted">{f.dataDocumentoLabel ?? '—'}</span>
              </td>
              <td className={`${fattureTdNumero} align-top`}>
                <div className="min-w-0" title={f.numero_fattura?.trim() || undefined}>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="font-medium text-app-fg">{f.numero_fattura?.trim() || '—'}</span>
                    {f.email_sync_auto_saved_at ? (
                      <span
                        className="inline-flex h-2 w-2 shrink-0 rounded-full bg-teal-400 ring-2 ring-teal-400/25"
                        title={t.common.emailSyncAutoSavedBadge}
                        aria-label={t.common.emailSyncAutoSavedBadge}
                      />
                    ) : null}
                    {f.is_credit_note ? (
                      <span
                        className="rounded bg-amber-500/25 px-1 py-px text-[9px] font-bold uppercase leading-none text-amber-100"
                        title="Credit Note"
                      >
                        NC
                      </span>
                    ) : null}
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
                  </div>
                  {f.numero_fattura?.trim() ? (
                    <p className="mt-0.5 text-[10px] leading-snug text-app-fg-muted/70">
                      {docKind}
                      {attachKind ? ` · ${attachKind}` : ''}
                    </p>
                  ) : null}
                  {f.approval_status && f.approval_status !== 'approved' ? (
                    <div className="mt-1">
                      <ApprovalBadge
                        status={f.approval_status as 'pending' | 'approved' | 'rejected'}
                        rejectionReason={f.rejection_reason}
                        size="sm"
                      />
                    </div>
                  ) : null}
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
                </div>
              </td>
              <td
                className={`${fattureTd} whitespace-nowrap text-right font-mono text-[13px] font-semibold tabular-nums ${
                  f.importoLabel
                    ? f.is_credit_note
                      ? APP_SECTION_AMOUNT_NEGATIVE_CLASS
                      : APP_SECTION_AMOUNT_POSITIVE_CLASS
                    : 'text-app-fg-muted'
                }`}
              >
                {f.importoLabel ?? '—'}
              </td>
              <td className={`${fattureTd} text-right`}>
                <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                  {f.file_url ? (
                    <DocumentRowActions
                      item={documentActionItemForFattura(
                        { ...f, sede_id: null, data: f.dataDocumentoFull ?? null, importo: null },
                        f.fornitore_id ?? '',
                        f.fornitoreNome ?? '',
                      )}
                      fileUrl={f.file_url}
                      fornitoreId={f.fornitore_id}
                      iconOnly
                      className="flex items-center justify-end gap-0.5"
                    />
                  ) : null}
                </div>
              </td>
            </tr>
            )
          })}
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
