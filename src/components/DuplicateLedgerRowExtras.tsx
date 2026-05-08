'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { FatturaDuplicateDeletionPayload } from '@/lib/check-duplicates'
import { deleteDuplicateRow, type DuplicateTable } from '@/lib/duplicate-invoice-actions'
import { useToast } from '@/lib/toast-context'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { ActionButton } from '@/components/ui/ActionButton'

export type DuplicateLedgerKind = 'bolla' | 'ordine' | 'fattura'

export function DuplicateLedgerRowExtras({
  rowId,
  payload,
  kind,
  duplicateBadgeLabel,
  duplicateDeleteConfirm,
  removeCopyLabel,
  deleteFailedPrefix,
  refreshRouter = true,
  onAfterDelete,
}: {
  rowId: string
  payload: FatturaDuplicateDeletionPayload
  kind: DuplicateLedgerKind
  duplicateBadgeLabel: string
  duplicateDeleteConfirm: string
  removeCopyLabel: string
  deleteFailedPrefix: string
  /** Se false, non chiamare `router.refresh()` (es. tab fornitore con stato locale). Default true. */
  refreshRouter?: boolean
  onAfterDelete?: () => void
}) {
  const router = useRouter()
  const supabase = createClient()
  const { showToast } = useToast()
  const [deleting, setDeleting] = useState(false)

  const memberSet = payload.memberIds.includes(rowId)
  const excess = payload.excessIds.includes(rowId)

  const removeCopy = useCallback(async () => {
    if (!excess) return
    if (!window.confirm(duplicateDeleteConfirm)) return
    setDeleting(true)
    const table: DuplicateTable = kind === 'bolla' ? 'bolle' : kind === 'ordine' ? 'conferme_ordine' : 'fatture'
    const { error } = await deleteDuplicateRow(supabase, table, rowId)
    setDeleting(false)
    if (error) {
      showToast(`${deleteFailedPrefix} ${error}`, 'error')
      return
    }
    onAfterDelete?.()
    if (refreshRouter) router.refresh()
  }, [
    duplicateDeleteConfirm,
    deleteFailedPrefix,
    excess,
    kind,
    onAfterDelete,
    refreshRouter,
    rowId,
    router,
    supabase,
  ])

  if (!memberSet) return null

  return (
    <>
      <StatusBadge tone="red" className="ml-1.5 align-middle">
        {duplicateBadgeLabel}
      </StatusBadge>
      {excess ? (
        <ActionButton
          type="button"
          intent="danger"
          size="sm"
          className="ml-1.5 align-middle"
          disabled={deleting}
          onClick={() => void removeCopy()}
        >
          {deleting ? '…' : removeCopyLabel}
        </ActionButton>
      ) : null}
    </>
  )
}
