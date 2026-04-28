'use client'

import type {
  EmailScanConnectStep,
  EmailScanMailboxContext,
  EmailScanPhase,
  EmailScanStreamEvent,
} from '@/lib/email-scan-stream'
import type { EmailSyncDocumentKind } from '@/lib/email-sync-scope-prefs'

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

/** Se `active` resta true senza heartbeat recente, consente una nuova sincronizzazione (HMR, stream troncato, ecc.). */
const SYNC_STALE_LOCK_MS = 90_000

export type EmailSyncRequestBody = {
  user_sede_id?: string
  filter_sede_id?: string
  fornitore_id?: string
  stream?: boolean
  email_sync_scope?: 'lookback' | 'fiscal_year'
  fiscal_year?: number
  /** Override giorni lookback (solo scope lookback); assente = usa imap_lookback_days sede */
  email_sync_lookback_days?: number
  /** Filtro tipologia import (assente o `all` = comportamento completo). */
  email_sync_document_kind?: EmailSyncDocumentKind
  /** Finestra IMAP server-side (`auto`=3h, `manual`=24h, `historical`=giorni sede/override). */
  mode?: 'auto' | 'manual' | 'historical'
}

export type EmailSyncProgressState = {
  active: boolean
  stalled: boolean
  phase: EmailScanPhase | null
  /** Sotto-stato IMAP durante `phase === 'connect'`. */
  connectStep: EmailScanConnectStep | null
  percent: number
  mailsFound: number
  mailsProcessed: number
  /** Documenti importati in app (stesso significato di `ricevuti` lato API). */
  ricevuti: number
  ignorate: number
  bozzeCreate: number
  /** Allegati/corpi già elaborati in sync precedente (fingerprint in log). */
  skippedAlreadyCompleted: number
  attachmentsTotal: number
  attachmentsProcessed: number
  connectionWarning: string | null
  /** Retry connessione IMAP (solo fase `connect`). */
  imapRetry: { attempt: number; maxAttempts: number } | null
  toast: { type: 'ok' | 'warn' | 'error'; text: string } | null
  mailboxContext: EmailScanMailboxContext | null
}

const initialProgress: EmailSyncProgressState = {
  active: false,
  stalled: false,
  phase: null,
  connectStep: null,
  percent: 0,
  mailsFound: 0,
  mailsProcessed: 0,
  ricevuti: 0,
  ignorate: 0,
  bozzeCreate: 0,
  skippedAlreadyCompleted: 0,
  attachmentsTotal: 0,
  attachmentsProcessed: 0,
  connectionWarning: null,
  imapRetry: null,
  toast: null,
  mailboxContext: null,
}

let progressStore: EmailSyncProgressState = { ...initialProgress }
const listeners = new Set<(p: EmailSyncProgressState) => void>()
let lastStreamTick = 0
let syncAbortController: AbortController | null = null
let userCancelledEmailSync = false

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

/** Interrompe fetch/stream avviati da `runEmailSyncJob` (es. sync avviata per errore). */
/** Chiude il riepilogo post-sync (ok/warn); non tocca errori né sync in corso. */
export function dismissEmailSyncCompletionBanner() {
  applyEmailSyncProgress((p) => {
    if (p.phase !== 'complete' || p.toast === null || p.toast.type === 'error') return p
    return { ...p, toast: null }
  })
}

export function cancelEmailSyncJob(cancelledMessage: string) {
  if (!progressStore.active && !syncAbortController) return
  userCancelledEmailSync = true
  syncAbortController?.abort()
  clearPendingSync()
  applyEmailSyncProgress(() => ({
    ...initialProgress,
    toast: { type: 'warn', text: cancelledMessage },
  }))
  window.setTimeout(
    () => applyEmailSyncProgress((p) => ({ ...p, toast: null })),
    5000,
  )
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
  emailSyncStreamIncomplete: string
  emailSyncAlreadyRunning: string
}

/**
 * Esegue la sincronizzazione fuori dal ciclo di vita dei singoli componenti:
 * il fetch/stream continua anche navigando tra le pagine o se React rimonta il provider.
 * `AbortSignal` solo per stop esplicito utente (`cancelEmailSyncJob`), non per la navigazione.
 */
export async function runEmailSyncJob(
  body: EmailSyncRequestBody,
  opts: { resumed?: boolean } | undefined,
  messages: RunMessages,
  onRouterRefresh: () => void,
): Promise<void> {
  if (progressStore.active) {
    const tick = getLastEmailSyncStreamTick()
    const heartbeatFresh = tick > 0 && Date.now() - tick < SYNC_STALE_LOCK_MS
    if (heartbeatFresh) {
      applyEmailSyncProgress((p) => ({
        ...p,
        toast: { type: 'warn', text: messages.emailSyncAlreadyRunning },
      }))
      window.setTimeout(
        () => applyEmailSyncProgress((p) => (p.toast?.text === messages.emailSyncAlreadyRunning ? { ...p, toast: null } : p)),
        8000,
      )
      return
    }
    applyEmailSyncProgress(() => ({ ...initialProgress }))
  }

  userCancelledEmailSync = false
  stashPendingSync(body)
  applyEmailSyncProgress(() => ({
    ...initialProgress,
    active: true,
    phase: 'connect',
    connectStep: null,
    percent: 10,
    connectionWarning: null,
    toast: opts?.resumed ? { type: 'ok', text: messages.emailSyncResumed } : null,
    mailboxContext: null,
  }))
  touchEmailSyncStream()

  try {
    syncAbortController = new AbortController()
    const res = await fetch('/api/scan-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...body, stream: true }),
      cache: 'no-store',
      signal: syncAbortController.signal,
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
        connectStep: null,
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

    let streamTerminated = false
    await readNdjsonStream(res, (ev: EmailScanStreamEvent) => {
      touchEmailSyncStream()
      if (ev.type === 'progress') {
        applyEmailSyncProgress((p) => {
          const imapRetry =
            ev.phase === 'connect'
              ? (ev.imapRetry !== undefined ? ev.imapRetry : p.imapRetry)
              : null
          const pctIn = ev.percent
          const percent =
            typeof pctIn === 'number' && Number.isFinite(pctIn) ? pctIn : p.percent
          const attTot = ev.attachmentsTotal
          const attNew =
            typeof ev.attachmentsProcessed === 'number' && Number.isFinite(ev.attachmentsProcessed)
              ? ev.attachmentsProcessed
              : p.attachmentsProcessed
          const attachmentsTotal =
            typeof attTot === 'number' && Number.isFinite(attTot) ? attTot : p.attachmentsTotal
          const attachmentsProcessed = Math.max(p.attachmentsProcessed, attNew)
          const nextPhase = ev.phase
          const nextConnectStep =
            nextPhase !== 'connect'
              ? null
              : ev.connectStep !== undefined
                ? ev.connectStep
                : p.connectStep
          return {
            ...p,
            stalled: false,
            phase: nextPhase,
            connectStep: nextConnectStep,
            percent,
            mailsFound: ev.mailsFound ?? p.mailsFound,
            mailsProcessed: ev.mailsProcessed ?? p.mailsProcessed,
            ricevuti: ev.ricevuti ?? p.ricevuti,
            ignorate: ev.ignorate ?? p.ignorate,
            bozzeCreate: ev.bozzeCreate ?? p.bozzeCreate,
            skippedAlreadyCompleted:
              ev.skippedAlreadyCompleted !== undefined
                ? ev.skippedAlreadyCompleted
                : p.skippedAlreadyCompleted,
            attachmentsTotal,
            attachmentsProcessed,
            connectionWarning:
              ev.connectionWarning !== undefined ? ev.connectionWarning : p.connectionWarning,
            imapRetry,
            mailboxContext:
              ev.mailboxContext !== undefined ? ev.mailboxContext ?? null : p.mailboxContext,
          }
        })
      } else if (ev.type === 'error') {
        streamTerminated = true
        clearPendingSync()
        applyEmailSyncProgress((p) => ({
          ...p,
          active: false,
          stalled: false,
          connectStep: null,
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
        streamTerminated = true
        clearPendingSync()
        const tipo = ev.avvisi?.length ? 'warn' : 'ok'
        applyEmailSyncProgress((p) => ({
          ...p,
          active: false,
          stalled: false,
          phase: 'complete',
          connectStep: null,
          percent: 100,
          connectionWarning: null,
          imapRetry: null,
          mailsFound: ev.mailsFound ?? p.mailsFound,
          mailsProcessed: ev.mailsProcessed ?? p.mailsProcessed,
          ricevuti: ev.ricevuti ?? p.ricevuti,
          ignorate: ev.ignorate ?? p.ignorate,
          bozzeCreate: ev.bozzeCreate ?? p.bozzeCreate,
          skippedAlreadyCompleted:
            ev.skippedAlreadyCompleted !== undefined
              ? ev.skippedAlreadyCompleted
              : p.skippedAlreadyCompleted,
          attachmentsTotal: ev.attachmentsTotal ?? p.attachmentsTotal,
          attachmentsProcessed: ev.attachmentsProcessed ?? p.attachmentsProcessed,
          mailboxContext: p.mailboxContext,
          toast: { type: tipo, text: ev.messaggio },
        }))
        onRouterRefresh()
      }
    })

    if (!streamTerminated && getEmailSyncProgressSnapshot().active) {
      clearPendingSync()
      applyEmailSyncProgress((p) => ({
        ...p,
        active: false,
        stalled: false,
        connectStep: null,
        connectionWarning: null,
        imapRetry: null,
        mailboxContext: null,
        toast: { type: 'warn', text: messages.emailSyncStreamIncomplete },
      }))
      window.setTimeout(
        () => applyEmailSyncProgress((p) => ({ ...p, toast: null })),
        6500,
      )
    }
  } catch {
    if (userCancelledEmailSync) {
      userCancelledEmailSync = false
      return
    }
    clearPendingSync()
    applyEmailSyncProgress((p) => ({
      ...p,
      active: false,
      stalled: false,
      connectStep: null,
      connectionWarning: null,
      imapRetry: null,
      mailboxContext: null,
      toast: { type: 'error', text: messages.networkError },
    }))
    window.setTimeout(
      () => applyEmailSyncProgress((p) => ({ ...p, toast: null })),
      6000,
    )
  } finally {
    syncAbortController = null
  }
}
