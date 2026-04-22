'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  getPendingActions,
  removeAction,
  incrementRetries,
  getPendingCount,
} from '@/lib/offline-queue'
import { useOnlineStatus } from './use-online-status'

export type SyncResult = { success: number; failed: number }

export function useOfflineSync() {
  const isOnline = useOnlineStatus()
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null)

  const refreshCount = useCallback(async () => {
    if (typeof indexedDB === 'undefined') return
    const count = await getPendingCount()
    setPendingCount(count)
  }, [])

  useEffect(() => {
    void refreshCount()
  }, [refreshCount])

  const syncPending = useCallback(async () => {
    if (!isOnline || syncing) return
    if (typeof indexedDB === 'undefined') return
    const actions = await getPendingActions()
    if (actions.length === 0) return

    setSyncing(true)
    let success = 0
    let failed = 0

    for (const action of actions) {
      try {
        if (action.type === 'bolla.create') {
          const formData = new FormData()
          for (const [k, v] of Object.entries(action.payload)) {
            if (v != null) formData.append(k, String(v))
          }
          if (action.fileData && action.fileType) {
            const blob = await fetch(action.fileData).then((r) => r.blob())
            formData.append('file', blob, 'offline-scan.jpg')
          }
          const res = await fetch('/api/bolle', { method: 'POST', body: formData })
          if (res.ok) {
            await removeAction(action.id)
            success++
          } else {
            await incrementRetries(action.id)
            failed++
          }
        }

        if (action.type === 'documento.discard') {
          const res = await fetch('/api/documenti-da-processare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...action.payload, azione: 'scarta' }),
          })
          if (res.ok) {
            await removeAction(action.id)
            success++
          } else {
            await incrementRetries(action.id)
            failed++
          }
        }
      } catch {
        await incrementRetries(action.id)
        failed++
      }
    }

    setSyncing(false)
    setLastSyncResult({ success, failed })
    await refreshCount()

    // Clear last sync result after 5s
    setTimeout(() => setLastSyncResult(null), 5000)
  }, [isOnline, syncing, refreshCount])

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      void syncPending()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  return { isOnline, pendingCount, syncing, lastSyncResult, syncPending, refreshCount }
}
