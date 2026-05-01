'use client'

import { useState, type ReactNode } from 'react'
import {
  APP_SECTION_STICKY_TOP_INNER_X_CLASS,
  APP_SECTION_STICKY_TOP_STACK_CLASS,
} from '@/lib/app-shell-layout'

type Props = {
  labels: { log: string; blacklist: string }
  logPanel: React.ReactNode
  blacklistPanel: React.ReactNode
  /**
   * Fascia in cima resa sticky assieme ai tab (stesso scroll di `#app-main`), es. strip titolo `/log`.
   */
  stickyHeader?: ReactNode
  /** Fascia aggiuntiva sticky sotto i tab, solo con `tab === 'log'` (es. riepilogo + Elabora su `/log`). */
  stickyAfterLogTab?: ReactNode
}

export default function EmailLogTabs({
  labels,
  logPanel,
  blacklistPanel,
  stickyHeader,
  stickyAfterLogTab,
}: Props) {
  const [tab, setTab] = useState<'log' | 'blacklist'>('log')

  const tabBar = (
    <div
      className={`flex gap-1 rounded-lg border border-app-soft-border bg-black/20 p-1 ${
        stickyHeader ? '' : 'mb-4'
      }`}
    >
        <button
          type="button"
          onClick={() => setTab('log')}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
            tab === 'log'
              ? 'bg-white/10 text-app-fg shadow-sm'
              : 'text-app-fg-muted hover:bg-white/5 hover:text-app-fg'
          }`}
        >
          {labels.log}
        </button>
        <button
          type="button"
          onClick={() => setTab('blacklist')}
          className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors ${
            tab === 'blacklist'
              ? 'bg-white/10 text-app-fg shadow-sm'
              : 'text-app-fg-muted hover:bg-white/5 hover:text-app-fg'
          }`}
        >
          {labels.blacklist}
        </button>
    </div>
  )

  if (stickyHeader) {
    return (
      <>
        <div
          className={`${APP_SECTION_STICKY_TOP_STACK_CLASS} flex flex-col gap-3 md:gap-4 pb-3 md:pb-4`}
        >
          <div className={APP_SECTION_STICKY_TOP_INNER_X_CLASS}>{stickyHeader}</div>
          <div className={APP_SECTION_STICKY_TOP_INNER_X_CLASS}>{tabBar}</div>
          {tab === 'log' && stickyAfterLogTab ? (
            <div className={APP_SECTION_STICKY_TOP_INNER_X_CLASS}>{stickyAfterLogTab}</div>
          ) : null}
        </div>
        {tab === 'log' ? logPanel : blacklistPanel}
      </>
    )
  }

  return (
    <>
      {tabBar}
      {tab === 'log' ? logPanel : blacklistPanel}
    </>
  )
}
