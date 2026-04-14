/** Testi dashboard per le righe di riepilogo sync (barra + header). */
export type EmailSyncStatLineTexts = {
  emailSyncStatFoundLine: string
  emailSyncStatImportedLine: string
  emailSyncStatProcessedLine: string
  /** Opzionale se > 0 — {n} = unità già in log da sync precedente */
  emailSyncStatAlreadyLine: string
  emailSyncStatIgnoredLine: string
  emailSyncStatDraftsLine: string
}

export function buildEmailSyncMailStatLines(
  d: EmailSyncStatLineTexts,
  found: number,
  processed: number,
  imported: number,
  ignored: number,
  drafts: number,
  alreadySkipped: number,
): { text: string; key: string }[] {
  const lines: { text: string; key: string }[] = [
    {
      key: 'found',
      text: d.emailSyncStatFoundLine.replace(/\{found\}/g, String(found)),
    },
    {
      key: 'imported',
      text: d.emailSyncStatImportedLine.replace(/\{imported\}/g, String(imported)),
    },
    {
      key: 'processed',
      text: d.emailSyncStatProcessedLine.replace(/\{processed\}/g, String(processed)),
    },
  ]
  if (alreadySkipped > 0) {
    lines.push({
      key: 'already',
      text: d.emailSyncStatAlreadyLine.replace(/\{n\}/g, String(alreadySkipped)),
    })
  }
  if (ignored > 0) {
    lines.push({
      key: 'ignored',
      text: d.emailSyncStatIgnoredLine.replace(/\{ignored\}/g, String(ignored)),
    })
  }
  if (drafts > 0) {
    lines.push({
      key: 'drafts',
      text: d.emailSyncStatDraftsLine.replace(/\{drafts\}/g, String(drafts)),
    })
  }
  return lines
}
