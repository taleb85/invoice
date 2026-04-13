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
import type { EmailScanPhase, EmailScanStreamEvent } from '@/lib/email-scan-stream'

const STALL_MS = 30_000
const STALL_RECONNECT_MAX = 3

const SK_PENDING = 'fluxo-email-sync-pending'
const SK_BODY = 'fluxo-email-sync-body'
const SK_ATT = 'fluxo-email-sync-resume-att'
const MAX_RESUME_ATTEMPTS = 5
const ONLINE_DEBOUNCE_MS = 800

function stashPendingSync(body: EmailSyncRequestBody) {
  if (typeof sessionStorage === 'undefined') return
  try {
    const b = { ...body, stream: true as const }
    sessionStorage.setItem(SK_BODY, JSON.stringify(b))
    sessionStorage.setItem(SK_PENDING, '1')
  } catch {
    /* ignore */
  }
}

function clearPendingSync() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(SK_BODY)
    sessionStorage.removeItem(SK_PENDING)
    sessionStorage.removeItem(SK_ATT)
  } catch {
    /* ignore */
  }
}

function readPendingBody(): EmailSyncRequestBody | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    if (sessionStorage.getItem(SK_PENDING) !== '1') return null
    const raw = sessionStorage.getItem(SK_BODY)
    if (!raw) return null
    return JSON.parse(raw) as EmailSyncRequestBody
  } catch {
    return null
  }
}

export type EmailSyncRequestBody = {
  user_sede_id?: string
  filter_sede_id?: string
  fornitore_id?: string
  stream?: boolean
}

type ProgressState = {
  active: boolean
  stalled: boolean
  phase: EmailScanPhase | null
  percent: number
  mailsFound: number
  mailsProcessed: number
  attachmentsTotal: number
  attachmentsProcessed: number
  /** Messaggio rosso durante retry IMAP (stream da API). */
  connectionWarning: string | null
  /** Onda di stall (1…STALL_RECONNECT_MAX) mostrata sotto “Nessun aggiornamento…”. */
  stalledWave: number
  toast: { type: 'ok' | 'warn' | 'error'; text: string } | null
}

const initialProgress: ProgressState = {
  active: false,
  stalled: false,
  phase: null,
  percent: 0,
  mailsFound: 0,
  mailsProcessed: 0,
  attachmentsTotal: 0,
  attachmentsProcessed: 0,
  connectionWarning: null,
  stalledWave: 0,
  toast: null,
}

type Ctx = {
  progress: ProgressState
  runEmailSync: (body: EmailSyncRequestBody, opts?: { resumed?: boolean }) => Promise<void>
}

const EmailSyncProgressContext = createContext<Ctx | null>(null)

async function readNdjsonStream(
  res: Response,
  onEvent: (e: EmailScanStreamEvent) => void
): Promise<void> {
  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      const t = line.trim()
      if (!t) continue
      onEvent(JSON.parse(t) as EmailScanStreamEvent)
    }
  }
  const tail = buf.trim()
  if (tail) onEvent(JSON.parse(tail) as EmailScanStreamEvent)
}

export function EmailSyncProgressProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<ProgressState>(initialProgress)
  const lastTickRef = useRef<number>(0)
  const prevStalledRef = useRef(false)
  const router = useRouter()
  const { t } = useLocale()

  useEffect(() => {
    if (!progress.active) return
    const id = window.setInterval(() => {
      const stalled = Date.now() - lastTickRef.current > STALL_MS
      setProgress((p) => (p.stalled === stalled ? p : { ...p, stalled }))
    }, 1000)
    return () => window.clearInterval(id)
  }, [progress.active])

  useEffect(() => {
    if (!progress.active) {
      prevStalledRef.current = false
      return
    }
    if (progress.stalled && !prevStalledRef.current) {
      setProgress((p) => ({
        ...p,
        stalledWave: Math.min(STALL_RECONNECT_MAX, p.stalledWave + 1),
      }))
    }
    prevStalledRef.current = progress.stalled
  }, [progress.active, progress.stalled])

  const touch = useCallback(() => {
    lastTickRef.current = Date.now()
  }, [])

  const runEmailSync = useCallback(
    async (body: EmailSyncRequestBody, opts?: { resumed?: boolean }) => {
      stashPendingSync(body)
      setProgress({
        ...initialProgress,
        active: true,
        phase: 'connect',
        percent: 10,
        connectionWarning: null,
        stalledWave: 0,
        toast: opts?.resumed ? { type: 'ok', text: t.ui.emailSyncResumed } : null,
      })
      touch()
      try {
        const res = await fetch('/api/scan-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, stream: true }),
        })

        if (!res.ok) {
          clearPendingSync()
          let msg = 'Errore sincronizzazione'
          try {
            const j = await res.json()
            if (j?.error) msg = String(j.error)
          } catch {
            /* ignore */
          }
        setProgress((p) => ({
          ...p,
          active: false,
          stalled: false,
          stalledWave: 0,
          connectionWarning: null,
          toast: { type: 'error', text: msg },
        }))
          setTimeout(() => setProgress((p) => ({ ...p, toast: null })), 6000)
          return
        }

        await readNdjsonStream(res, (ev: EmailScanStreamEvent) => {
          touch()
          if (ev.type === 'progress') {
            setProgress((p) => ({
              ...p,
              stalled: false,
              stalledWave: 0,
              phase: ev.phase,
              percent: ev.percent,
              mailsFound: ev.mailsFound ?? p.mailsFound,
              mailsProcessed: ev.mailsProcessed ?? p.mailsProcessed,
              attachmentsTotal: ev.attachmentsTotal ?? p.attachmentsTotal,
              attachmentsProcessed: ev.attachmentsProcessed ?? p.attachmentsProcessed,
              connectionWarning:
                ev.connectionWarning !== undefined ? ev.connectionWarning : p.connectionWarning,
            }))
          } else if (ev.type === 'error') {
            clearPendingSync()
            setProgress((p) => ({
              ...p,
              active: false,
              stalled: false,
              stalledWave: 0,
              connectionWarning: null,
              toast: { type: 'error', text: ev.error },
            }))
            setTimeout(() => setProgress((p) => ({ ...p, toast: null })), 6000)
          } else if (ev.type === 'done') {
            clearPendingSync()
            const tipo = ev.avvisi?.length ? 'warn' : 'ok'
            setProgress((p) => ({
              ...p,
              active: false,
              stalled: false,
              stalledWave: 0,
              phase: 'complete',
              percent: 100,
              connectionWarning: null,
              mailsFound: ev.mailsFound ?? p.mailsFound,
              mailsProcessed: ev.mailsProcessed ?? p.mailsProcessed,
              attachmentsTotal: ev.attachmentsTotal ?? p.attachmentsTotal,
              attachmentsProcessed: ev.attachmentsProcessed ?? p.attachmentsProcessed,
              toast: { type: tipo, text: ev.messaggio },
            }))
            router.refresh()
            setTimeout(() => setProgress((p) => ({ ...p, toast: null })), 5000)
          }
        })
      } catch {
        setProgress((p) => ({
          ...p,
          active: false,
          stalled: false,
          stalledWave: 0,
          connectionWarning: null,
          toast: { type: 'error', text: t.ui.networkError },
        }))
        setTimeout(() => setProgress((p) => ({ ...p, toast: null })), 6000)
      }
    },
    [router, t.ui.emailSyncResumed, t.ui.networkError, touch]
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
        const att = parseInt(sessionStorage.getItem(SK_ATT) || '0', 10)
        if (att >= MAX_RESUME_ATTEMPTS) {
          clearPendingSync()
          setProgress((p) => ({
            ...p,
            toast: { type: 'error', text: t.ui.networkError },
          }))
          setTimeout(() => setProgress((p) => ({ ...p, toast: null })), 6000)
          return
        }
        sessionStorage.setItem(SK_ATT, String(att + 1))
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

/** Optional: pagine fuori dal provider (non dovrebbe capitare). */
export function useEmailSyncProgressOptional() {
  return useContext(EmailSyncProgressContext)
}
