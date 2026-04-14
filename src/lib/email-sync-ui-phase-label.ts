import type { EmailScanConnectStep, EmailScanPhase } from '@/lib/email-scan-stream'

/** Sottoinsieme `dashboard` per titolo barra / header sync. */
export type EmailSyncPhaseLabelDashboard = {
  syncing: string
  emailSyncQueued: string
  emailSyncPhaseConnect: string
  emailSyncConnectToServer: string
  emailSyncConnectOpeningMailbox: string
  emailSyncPhaseSearch: string
  emailSyncPhaseProcess: string
  emailSyncPhasePersist: string
  emailSyncPhaseDone: string
}

export function emailSyncProgressPhaseTitle(
  phase: EmailScanPhase | null,
  connectStep: EmailScanConnectStep | null,
  d: EmailSyncPhaseLabelDashboard,
): string {
  if (phase === 'connect') {
    if (connectStep === 'to_server') return d.emailSyncConnectToServer
    if (connectStep === 'opening_mailbox') return d.emailSyncConnectOpeningMailbox
    return d.emailSyncPhaseConnect
  }
  switch (phase) {
    case 'queued':
      return d.emailSyncQueued
    case 'search':
      return d.emailSyncPhaseSearch
    case 'process':
      return d.emailSyncPhaseProcess
    case 'persist':
      return d.emailSyncPhasePersist
    case 'complete':
      return d.emailSyncPhaseDone
    default:
      return d.syncing
  }
}
