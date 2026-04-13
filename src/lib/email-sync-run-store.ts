'use client'

import type {
  EmailScanMailboxContext,
  EmailScanPhase,
  EmailScanStreamEvent,
} from '@/lib/email-scan-stream'

/** Soglia base (connessione / ricerca). */
const STALL_MS_DEFAULT = 45_000
const STALL_MS_PROCESS_MANY_ATTACH = 240_000
const STALL_MS_PROCESS_FEW = 120_000
const STALL_MS_PERSIST = 90_000
const STALL_ATTACH_THRESHOLD = 3

export { STALL_ATTACH_THRESHOLD, STALL_MS_DEFAULT, STALL_MS_PERSIST, STALL_MS_PROCESS_FEW, STALL_MS_PROCESS_MANY_ATTACH }

const SK_PENDING = 'fluxo-email-sync-pending'
const SK_BODY = 'fluxo-email-sync-body'
export const EMAIL_SYNC_RESUME_ATT_KEY = 'fluxo-email-sync-resume-att'
const SK_ATT = EMAIL_SYNC_RESUME_ATT_KEY
export const MAX_RESUME_ATTEMPTS = 5
export const ONLINE_DEBOUNCE_MS = 800

export type EmailSyncRequestBody = {
  user_sede_id?: string
  filter_sede_id?: string
  fornitore_id?: string
  stream?: boolean
  email_sync_scope?: 'lookback' | 'fiscal_year'
  fiscal_year?: number
}

export type EmailSyncProgressState = {
  active: boolean
  stalled: boolean
  phase: EmailScanPhase | null
  percent: number
  mailsFound: number
  mailsProcessed: number
  /** Documenti importati in app (stesso significato di `ricevuti` lato API). */
  ricevuti: number
  ignorate: number
  bozzeCreate: number
  attachmentsTotal: number
  attachmentsProcessed: number
  connectionWarning: string | null
  /** Retry connessione IMAP (solo fase `connect`). */
  imapRetry: { attempt: number; maxAttempts: number } | null
  stalledWave: number
  toast: { type: 'ok' | 'warn' | 'error'; text: string } | null
  mailboxContext: EmailScanMailboxContext | null
}

const initialProgress: EmailSyncProgressState = {
  active: false,
  stalled: false,
  phase: null,
  percent: 0,
  mailsFound: 0,
  mailsProcessed: 0,
  ricevuti: 0,
  ignorate: 0,
  bozzeCreate: 0,
  attachmentsTotal: 0,
  attachmentsProcessed: 0,
  connectionWarning: null,
  imapRetry: null,
  stalledWave: 0,
  toast: null,
  mailboxContext: null,
}

let progressStore: EmailSyncProgressState = { ...initialProgress }
const listeners = new Set<(p: EmailSyncProgressState) => void>()
let lastStreamTick = 0

function emit() {
  const snap = progressStore
  listeners.forEach((l) => l(snap))
}

export function getEmailSyncProgressSnapshot(): EmailSyncProgressState {
  return progressStore
}

export function subscribeEmailSyncProgress(listener: (p: EmailSyncProgressState) => void) {
  listener(progressStore)
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function applyEmailSyncProgress(
  updater: (p: EmailSyncProgressState) => EmailSyncProgressState,
) {
  progressStore = updater(progressStore)
  emit()
}

export function touchEmailSyncStream() {
  lastStreamTick = Date.now()
}

export function getLastEmailSyncStreamTick() {
  return lastStreamTick
}

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

export function clearPendingSync() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(SK_BODY)
    sessionStorage.removeItem(SK_PENDING)
    sessionStorage.removeItem(SK_ATT)
  } catch {
    /* ignore */
  }
}

export function readPendingBody(): EmailSyncRequestBody | null {
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

async function readNdjsonStream(
  res: Response,
  onEvent: (e: EmailScanStreamEvent) => void,
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

type RunMessages = {
  emailSyncResumed: string
  networkError: string
}

/**
 * Esegue la sincronizzazione fuori dal ciclo di vita dei singoli componenti:
 * il fetch/stream continua anche navigando tra le pagine o se React rimonta il provider.
 * Nessun AbortSignal: la navigazione in-app non deve interrompere la richiesta.
 */
export async function runEmailSyncJob(
  body: EmailSyncRequestBody,
  opts: { resumed?: boolean } | undefined,
  messages: RunMessages,
  onRouterRefresh: () => void,
): Promise<void> {
  if (progressStore.active) return

  stashPendingSync(body)
  applyEmailSyncProgress(() => ({
    ...initialProgress,
    active: true,
    phase: 'connect',
    percent: 10,
    connectionWarning: null,
    stalledWave: 0,
    toast: opts?.resumed ? { type: 'ok', text: messages.emailSyncResumed } : null,
    mailboxContext: null,
  }))
  touchEmailSyncStream()

  try {
    const res = await fetch('/api/scan-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, stream: true }),
      cache: 'no-store',
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
      applyEmailSyncProgress((p) => ({
        ...p,
        active: false,
        stalled: false,
        stalledWave: 0,
        connectionWarning: null,
        imapRetry: null,
        mailboxContext: null,
        toast: { type: 'error', text: msg },
      }))
      window.setTimeout(
        () => applyEmailSyncProgress((p) => ({ ...p, toast: null })),
        6000,
      )
      return
    }

    await readNdjsonStream(res, (ev: EmailScanStreamEvent) => {
      touchEmailSyncStream()
      if (ev.type === 'progress') {
        applyEmailSyncProgress((p) => {
          const imapRetry =
            ev.phase === 'connect'
              ? (ev.imapRetry !== undefined ? ev.imapRetry : p.imapRetry)
              : null
          return {
            ...p,
            stalled: false,
            phase: ev.phase,
            percent: ev.percent,
            mailsFound: ev.mailsFound ?? p.mailsFound,
            mailsProcessed: ev.mailsProcessed ?? p.mailsProcessed,
            ricevuti: ev.ricevuti ?? p.ricevuti,
            ignorate: ev.ignorate ?? p.ignorate,
            bozzeCreate: ev.bozzeCreate ?? p.bozzeCreate,
            attachmentsTotal: ev.attachmentsTotal ?? p.attachmentsTotal,
            attachmentsProcessed: ev.attachmentsProcessed ?? p.attachmentsProcessed,
            connectionWarning:
              ev.connectionWarning !== undefined ? ev.connectionWarning : p.connectionWarning,
            imapRetry,
            mailboxContext:
              ev.mailboxContext !== undefined ? ev.mailboxContext ?? null : p.mailboxContext,
          }
        })
      } else if (ev.type === 'error') {
        clearPendingSync()
        applyEmailSyncProgress((p) => ({
          ...p,
          active: false,
          stalled: false,
          stalledWave: 0,
          connectionWarning: null,
          imapRetry: null,
          mailboxContext: null,
          toast: { type: 'error', text: ev.error },
        }))
        window.setTimeout(
          () => applyEmailSyncProgress((p) => ({ ...p, toast: null })),
          6000,
        )
      } else if (ev.type === 'done') {
        clearPendingSync()
        const tipo = ev.avvisi?.length ? 'warn' : 'ok'
        applyEmailSyncProgress((p) => ({
          ...p,
          active: false,
          stalled: false,
          stalledWave: 0,
          phase: 'complete',
          percent: 100,
          connectionWarning: null,
          imapRetry: null,
          mailsFound: ev.mailsFound ?? p.mailsFound,
          mailsProcessed: ev.mailsProcessed ?? p.mailsProcessed,
          ricevuti: ev.ricevuti ?? p.ricevuti,
          ignorate: ev.ignorate ?? p.ignorate,
          bozzeCreate: ev.bozzeCreate ?? p.bozzeCreate,
          attachmentsTotal: ev.attachmentsTotal ?? p.attachmentsTotal,
          attachmentsProcessed: ev.attachmentsProcessed ?? p.attachmentsProcessed,
          mailboxContext: p.mailboxContext,
          toast: { type: tipo, text: ev.messaggio },
        }))
        onRouterRefresh()
        window.setTimeout(
          () => applyEmailSyncProgress((p) => ({ ...p, toast: null })),
          5000,
        )
      }
    })
  } catch {
    applyEmailSyncProgress((p) => ({
      ...p,
      active: false,
      stalled: false,
      stalledWave: 0,
      connectionWarning: null,
      imapRetry: null,
      mailboxContext: null,
      toast: { type: 'error', text: messages.networkError },
    }))
    window.setTimeout(
      () => applyEmailSyncProgress((p) => ({ ...p, toast: null })),
      6000,
    )
  }
}
