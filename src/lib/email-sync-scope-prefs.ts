'use client'

const KEY = 'fluxo-email-sync-scope-v1'

export type EmailSyncScopeMode = 'lookback' | 'fiscal_year'

export type EmailSyncScopePrefs = {
  mode: EmailSyncScopeMode
  fiscalYear: number
}

export function readEmailSyncScopePrefs(): EmailSyncScopePrefs {
  if (typeof window === 'undefined') {
    return { mode: 'lookback', fiscalYear: new Date().getUTCFullYear() }
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { mode: 'lookback', fiscalYear: new Date().getUTCFullYear() }
    const j = JSON.parse(raw) as { mode?: EmailSyncScopeMode; fiscalYear?: number }
    const mode = j.mode === 'fiscal_year' ? 'fiscal_year' : 'lookback'
    const fy = typeof j.fiscalYear === 'number' && j.fiscalYear >= 1990 && j.fiscalYear <= 2100
      ? j.fiscalYear
      : new Date().getUTCFullYear()
    return { mode, fiscalYear: fy }
  } catch {
    return { mode: 'lookback', fiscalYear: new Date().getUTCFullYear() }
  }
}

export function writeEmailSyncScopePrefs(p: EmailSyncScopePrefs) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    /* ignore */
  }
}

/** Campi opzionali da unire al body POST /api/scan-emails */
export function emailSyncScopeBodyFields(prefs: EmailSyncScopePrefs): {
  email_sync_scope: EmailSyncScopeMode
  fiscal_year?: number
} {
  if (prefs.mode === 'lookback') return { email_sync_scope: 'lookback' }
  return { email_sync_scope: 'fiscal_year', fiscal_year: prefs.fiscalYear }
}
