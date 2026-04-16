'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { FatturaDuplicateDeletionPayload } from '@/lib/check-duplicates'
import { deleteDuplicateBolla, deleteDuplicateOrdine } from '@/lib/duplicate-invoice-actions'

const dupBadgeCls =
  'ml-1.5 inline-flex shrink-0 align-middle rounded border border-orange-500/55 bg-orange-950/45 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-orange-200 shadow-[0_0_10px_rgba(251,146,60,0.35)]'

const dupRemoveBtnCls =
  'ml-1.5 inline-flex items-center gap-1 rounded-md border border-orange-500/45 bg-orange-950/40 px-2 py-0.5 text-[10px] font-semibold text-orange-100 transition-colors hover:bg-orange-800/35 disabled:cursor-not-allowed disabled:opacity-45'

export type DuplicateLedgerKind = 'bolla' | 'ordine'

export function DuplicateLedgerRowExtras({
  rowId,
  payload,
  kind,
  duplicateBadgeLabel,
  duplicateDeleteConfirm,
  removeCopyLabel,
  deleteFailedPrefix,
}: {
  rowId: string
  payload: FatturaDuplicateDeletionPayload
  kind: DuplicateLedgerKind
  duplicateBadgeLabel: string
  duplicateDeleteConfirm: string
  removeCopyLabel: string
  deleteFailedPrefix: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [deleting, setDeleting] = useState(false)

  const memberSet = payload.memberIds.includes(rowId)
  const excess = payload.excessIds.includes(rowId)

  const removeCopy = useCallback(async () => {
    if (!excess) return
    if (!window.confirm(duplicateDeleteConfirm)) return
    setDeleting(true)
    const { error } =
      kind === 'bolla'
        ? await deleteDuplicateBolla(supabase, rowId)
        : await deleteDuplicateOrdine(supabase, rowId)
    setDeleting(false)
    if (error) {
      window.alert(`${deleteFailedPrefix} ${error}`)
      return
    }
    router.refresh()
  }, [duplicateDeleteConfirm, deleteFailedPrefix, excess, kind, rowId, router, supabase])

  if (!memberSet) return null

  return (
    <>
      <span className={dupBadgeCls}>{duplicateBadgeLabel}</span>
      {excess ? (
        <button type="button" className={dupRemoveBtnCls} disabled={deleting} onClick={() => void removeCopy()}>
          {deleting ? '…' : removeCopyLabel}
        </button>
      ) : null}
    </>
  )
}
