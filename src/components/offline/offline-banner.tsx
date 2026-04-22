'use client'

import { useOfflineSync } from '@/hooks/use-offline-sync'

export function OfflineBanner() {
  const { isOnline, pendingCount, syncing, lastSyncResult, syncPending } = useOfflineSync()

  // Nothing to show when online, no pending, no recent sync
  if (isOnline && pendingCount === 0 && !lastSyncResult) return null

  const showOffline = !isOnline
  const showSyncing = isOnline && syncing
  const showSyncDone = isOnline && !syncing && lastSyncResult && lastSyncResult.success > 0

  return (
    <div
      className={`fixed left-0 right-0 top-0 z-[200] flex items-center justify-center gap-2 px-4 py-2 text-sm transition-all ${
        showOffline
          ? 'bg-amber-500/90 text-amber-950 backdrop-blur-sm'
          : showSyncing
            ? 'bg-[#22d3ee]/90 text-[#0a192f] backdrop-blur-sm'
            : showSyncDone
              ? 'bg-emerald-500/90 text-emerald-950 backdrop-blur-sm'
              : 'hidden'
      }`}
    >
      {showOffline && (
        <>
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728M9.172 9.172a4 4 0 015.656 0M3 3l18 18M10.828 10.828A4 4 0 019 14H5m14 0h-1.172" />
          </svg>
          <span className="font-medium">Modalità offline</span>
          {pendingCount > 0 && (
            <span className="font-normal opacity-80">· {pendingCount} {pendingCount === 1 ? 'azione in attesa' : 'azioni in attesa'}</span>
          )}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => void syncPending()}
              className="ml-1 rounded-full border border-amber-800/30 px-2 py-0.5 text-xs font-semibold hover:bg-amber-600/20"
            >
              Riprova
            </button>
          )}
        </>
      )}

      {showSyncing && (
        <>
          <div className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-[#0a192f] border-t-transparent" />
          <span className="font-medium">Sincronizzazione in corso…</span>
        </>
      )}

      {showSyncDone && lastSyncResult && (
        <>
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-medium">
            {lastSyncResult.success} {lastSyncResult.success === 1 ? 'azione sincronizzata' : 'azioni sincronizzate'}
          </span>
          {lastSyncResult.failed > 0 && (
            <span className="opacity-80">· {lastSyncResult.failed} fallite</span>
          )}
        </>
      )}
    </div>
  )
}
