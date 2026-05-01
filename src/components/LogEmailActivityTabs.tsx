'use client'

import { type ComponentProps, type ReactNode, useMemo } from 'react'
import EmailLogTabs from '@/components/EmailLogTabs'
import {
  EmailActivityLogPanel,
  type LogRowView,
  type ProcLabels,
} from '@/components/EmailActivityLogPanel'
import { useEmailActivityLogReprocess } from '@/components/email-activity-log-reprocess'
import { actionButtonClassName } from '@/components/ui/ActionButton'

type TLogPanel = ComponentProps<typeof EmailActivityLogPanel>['tLog']

export function LogEmailActivityTabs(props: {
  stickyHeader: ReactNode
  labels: { log: string; blacklist: string }
  blacklistPanel: ReactNode
  queueTotal: number
  autoProcessedToday: number
  logRowViews: LogRowView[]
  summaryLine: string
  documentoIdsForProcess: string[]
  sedeForProcessApi: string | null
  blacklistSedeFallback: string | null
  tLogPanel: TLogPanel
  procLabels: ProcLabels
  logPagination: ReactNode | null
  activityEmpty: string
  activityEmptySavedHidden: string
}) {
  const {
    stickyHeader,
    labels,
    blacklistPanel,
    queueTotal,
    autoProcessedToday,
    logRowViews,
    summaryLine,
    documentoIdsForProcess,
    sedeForProcessApi,
    blacklistSedeFallback,
    tLogPanel,
    procLabels,
    logPagination,
    activityEmpty,
    activityEmptySavedHidden,
  } = props

  const reprocessSlice = useMemo(
    () => ({
      activityProcessDocumentsCta: tLogPanel.activityProcessDocumentsCta,
      activityProcessDocumentsBusy: tLogPanel.activityProcessDocumentsBusy,
      activityProcessDocumentsNoEligibleInLog: tLogPanel.activityProcessDocumentsNoEligibleInLog,
      activityProcessDocumentsApiError: tLogPanel.activityProcessDocumentsApiError,
      activityProcessDocumentsSummary: tLogPanel.activityProcessDocumentsSummary,
      activityProcessToastDetail: tLogPanel.activityProcessToastDetail,
      activityQueueEmptyCelebrate: tLogPanel.activityQueueEmptyCelebrate,
    }),
    [tLogPanel],
  )

  const reprocess = useEmailActivityLogReprocess({
    documentoIds: documentoIdsForProcess,
    sedeId: sedeForProcessApi,
    tLog: reprocessSlice,
  })

  const btnDisabled = documentoIdsForProcess.length === 0 || reprocess.busy

  const stickyLogToolbar = (
    <div className="border-t border-white/[0.08] pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={`min-w-0 flex-1 text-sm ${queueTotal === 0 ? 'text-app-fg-muted' : 'text-app-fg'}`}
        >
          {summaryLine}
        </p>
        <button
          type="button"
          disabled={btnDisabled}
          className={`${actionButtonClassName('nav', 'sm')} ${btnDisabled ? 'opacity-50' : ''}`}
          aria-busy={reprocess.busy}
          title={
            documentoIdsForProcess.length === 0
              ? tLogPanel.activityProcessDocumentsNoEligibleInLog
              : tLogPanel.activityProcessDocumentsCta
          }
          onClick={() => void reprocess.run()}
        >
          {reprocess.busy ? tLogPanel.activityProcessDocumentsBusy : tLogPanel.activityProcessDocumentsCta}
        </button>
      </div>
    </div>
  )

  const logPanel =
    queueTotal === 0 ? (
      <div className="app-card overflow-hidden">
        <div className="p-16 text-center">
          <svg
            className="mx-auto h-12 w-12 text-app-fg-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-4 font-medium text-app-fg-muted">
            {autoProcessedToday > 0 ? activityEmptySavedHidden : activityEmpty}
          </p>
        </div>
      </div>
    ) : (
      <EmailActivityLogPanel
        hideToolbar
        reprocess={reprocess}
        rows={logRowViews}
        summaryLine={summaryLine}
        documentoIds={documentoIdsForProcess}
        blacklistSedeFallback={blacklistSedeFallback}
        tLog={tLogPanel}
        procLabels={procLabels}
        paginationFooter={logPagination}
      />
    )

  return (
    <EmailLogTabs
      stickyHeader={stickyHeader}
      stickyAfterLogTab={stickyLogToolbar}
      labels={labels}
      blacklistPanel={blacklistPanel}
      logPanel={logPanel}
    />
  )
}
