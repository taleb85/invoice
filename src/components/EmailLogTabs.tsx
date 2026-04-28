'use client'

import { useState } from 'react'

type Props = {
  labels: { log: string; blacklist: string }
  logPanel: React.ReactNode
  blacklistPanel: React.ReactNode
}

export default function EmailLogTabs({ labels, logPanel, blacklistPanel }: Props) {
  const [tab, setTab] = useState<'log' | 'blacklist'>('log')

  return (
    <>
      <div className="mb-4 flex gap-1 rounded-lg border border-app-soft-border bg-black/20 p-1">
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
      {tab === 'log' ? logPanel : blacklistPanel}
    </>
  )
}
