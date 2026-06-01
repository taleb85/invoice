'use client'

import DocumentOcrRefreshButton, {
  type DocumentOcrRefreshBatchItem,
} from '@/components/DocumentOcrRefreshButton'
import { useT } from '@/lib/use-t'

export type SupplierDocToolbarChoice = {
  id: string
  label: string
  hasFile: boolean
}

type Props = {
  choices: SupplierDocToolbarChoice[]
  selectedId: string
  onSelectedIdChange: (id: string) => void
  refreshBatch: DocumentOcrRefreshBatchItem[]
  readOnly?: boolean
  onLedgerMutated?: () => void
  /** Toolbar fatture: descrizione con sync listino. Altre tab: solo OCR. */
  variant?: 'fatture' | 'ocr-only'
  /** Slot opzionale (es. sync listino su tab Fatture). */
  extraActions?: React.ReactNode
}

export default function SupplierDocumentOcrToolbar({
  choices,
  selectedId,
  onSelectedIdChange,
  refreshBatch,
  readOnly,
  onLedgerMutated,
  variant = 'ocr-only',
  extraActions,
}: Props) {
  const t = useT()
  const withFile = choices.filter((c) => c.hasFile)
  const canRefresh = refreshBatch.length > 0

  if (!withFile.length || !canRefresh) return null

  const desc =
    variant === 'fatture'
      ? t.fatture.toolbarDocActionsDesc
      : t.fatture.toolbarDocActionsDescOcrOnly

  return (
    <div className="rounded-lg border border-app-line-28 bg-white/[0.04] p-4">
      <div className="mb-0 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-app-fg">{t.fatture.toolbarDocActionsTitle}</h3>
          <p className="mt-1 text-xs text-app-fg-muted">{desc}</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:items-end">
          {withFile.length > 1 ? (
            <label className="flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:min-w-[14rem]">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">
                {t.fatture.toolbarSelectDocument}
              </span>
              <select
                value={selectedId}
                onChange={(e) => onSelectedIdChange(e.target.value)}
                className="w-full rounded-lg border border-app-line-28 bg-app-line-10 px-2.5 py-1.5 text-xs text-app-fg"
              >
                {withFile.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DocumentOcrRefreshButton
              hasFile
              batch={refreshBatch}
              readOnly={readOnly}
              onLedgerMutated={onLedgerMutated}
            />
            {extraActions}
          </div>
        </div>
      </div>
    </div>
  )
}
