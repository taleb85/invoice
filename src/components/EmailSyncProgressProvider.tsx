'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/lib/locale-context'
import {
  applyEmailSyncProgress,
  getEmailSyncProgressSnapshot,
  getLastEmailSyncStreamTick,
  MAX_RESUME_ATTEMPTS,
  ONLINE_DEBOUNCE_MS,
  readPendingBody,
  clearPendingSync,
  EMAIL_SYNC_RESUME_ATT_KEY,
  runEmailSyncJob,
  STALL_ATTACH_THRESHOLD,
  STALL_MS_DEFAULT,
  STALL_MS_PERSIST,
  STALL_MS_PROCESS_FEW,
  STALL_MS_PROCESS_MANY_ATTACH,
  subscribeEmailSyncProgress,
  type EmailSyncProgressState,
  type EmailSyncRequestBody,
} from '@/lib/email-sync-run-store'

export type { EmailSyncRequestBody } from '@/lib/email-sync-run-store'

const STALL_RECONNECT_MAX = 3

type Ctx = {
  progress: EmailSyncProgressState
  runEmailSync: (body: EmailSyncRequestBody, opts?: { resumed?: boolean }) => Promise<void>
}

const EmailSyncProgressContext = createContext<Ctx | null>(null)

export function EmailSyncProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<EmailSyncProgressState>(() => getEmailSyncProgressSnapshot())
  const prevStalledRef = useRef(false)
  const router = useRouter()
  const { t } = useLocale()

  useEffect(() => subscribeEmailSyncProgress(setProgress), [])

  useEffect(() => {
    if (!progress.active) return
    const id = window.setInterval(() => {
      const p = getEmailSyncProgressSnapshot()
      const longVision =
        p.phase === 'process' && p.attachmentsTotal > STALL_ATTACH_THRESHOLD
      const threshold =
        p.phase === 'process'
          ? longVision
            ? STALL_MS_PROCESS_MANY_ATTACH
            : STALL_MS_PROCESS_FEW
          : p.phase === 'persist'
            ? STALL_MS_PERSIST
            : STALL_MS_DEFAULT
      const stalled = Date.now() - getLastEmailSyncStreamTick() > threshold
      applyEmailSyncProgress((prev) => (prev.stalled === stalled ? prev : { ...prev, stalled }))
    }, 1000)
    return () => window.clearInterval(id)
  }, [progress.active, progress.phase, progress.attachmentsTotal])

  useEffect(() => {
    if (!progress.active) {
      prevStalledRef.current = false
      return
    }
    if (progress.stalled && !prevStalledRef.current) {
      applyEmailSyncProgress((p) => ({
        ...p,
        stalledWave: Math.min(STALL_RECONNECT_MAX, p.stalledWave + 1),
      }))
    }
    prevStalledRef.current = progress.stalled
  }, [progress.active, progress.stalled])

  const runEmailSync = useCallback(
    async (body: EmailSyncRequestBody, opts?: { resumed?: boolean }) => {
      await runEmailSyncJob(
        body,
        opts,
        { emailSyncResumed: t.ui.emailSyncResumed, networkError: t.ui.networkError },
        () => router.refresh(),
      )
    },
    [router, t.ui.emailSyncResumed, t.ui.networkError],
  )

  const runEmailSyncRef = useRef(runEmailSync)
  runEmailSyncRef.current = runEmailSync

  useEffect(() => {
    if (typeof window === 'undefined') return
    let tmr: ReturnType<typeof setTimeout> | undefined
    const onOnline = () => {
      if (tmr) clearTimeout(tmr)
      tmr = setTimeout(() => {
        const body = readPendingBody()
        if (!body) return
        const att = parseInt(sessionStorage.getItem(EMAIL_SYNC_RESUME_ATT_KEY) || '0', 10)
        if (att >= MAX_RESUME_ATTEMPTS) {
          clearPendingSync()
          applyEmailSyncProgress((p) => ({
            ...p,
            toast: { type: 'error', text: t.ui.networkError },
          }))
          window.setTimeout(
            () => applyEmailSyncProgress((p) => ({ ...p, toast: null })),
            6000,
          )
          return
        }
        sessionStorage.setItem(EMAIL_SYNC_RESUME_ATT_KEY, String(att + 1))
        void runEmailSyncRef.current({ ...body, stream: true }, { resumed: true })
      }, ONLINE_DEBOUNCE_MS)
    }
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('online', onOnline)
      if (tmr) clearTimeout(tmr)
    }
  }, [t.ui.networkError])

  const value = useMemo(() => ({ progress, runEmailSync }), [progress, runEmailSync])

  return (
    <EmailSyncProgressContext.Provider value={value}>{children}</EmailSyncProgressContext.Provider>
  )
}

export function useEmailSyncProgress() {
  const ctx = useContext(EmailSyncProgressContext)
  if (!ctx) {
    throw new Error('useEmailSyncProgress must be used within EmailSyncProgressProvider')
  }
  return ctx
}

export function useEmailSyncProgressOptional() {
  return useContext(EmailSyncProgressContext)
}
