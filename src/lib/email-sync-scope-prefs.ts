'use client'

const KEY = 'fluxo-email-sync-scope-v1'

export type EmailSyncScopeMode = 'lookback' | 'fiscal_year'

/** Cosa importare/elaborare in priorità durante la sync IMAP (default: tutto). */
export type EmailSyncDocumentKind = 'all' | 'fornitore' | 'bolla' | 'fattura' | 'estratto_conto'

export type EmailSyncScopePrefs = {
  mode: EmailSyncScopeMode
  fiscalYear: number
  /**
   * Solo in modalità lookback: `null` = usa `imap_lookback_days` della sede sul server.
   * Numero = override per questa sincronizzazione (giorni).
   */
  lookbackDays: number | null
  documentKind: EmailSyncDocumentKind
}

function defaultPrefs(): EmailSyncScopePrefs {
  return {
    mode: 'lookback',
    fiscalYear: new Date().getUTCFullYear(),
    lookbackDays: null,
    documentKind: 'all',
  }
}

export function readEmailSyncScopePrefs(): EmailSyncScopePrefs {
  if (typeof window === 'undefined') {
    return defaultPrefs()
  }
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultPrefs()
    const j = JSON.parse(raw) as {
      mode?: EmailSyncScopeMode
      fiscalYear?: number
      lookbackDays?: number | null
      documentKind?: EmailSyncDocumentKind
    }
    const mode = j.mode === 'fiscal_year' ? 'fiscal_year' : 'lookback'
    const fy = typeof j.fiscalYear === 'number' && j.fiscalYear >= 1990 && j.fiscalYear <= 2100
      ? j.fiscalYear
      : new Date().getUTCFullYear()
    let lookbackDays: number | null = null
    if (typeof j.lookbackDays === 'number' && Number.isFinite(j.lookbackDays)) {
      const n = Math.floor(j.lookbackDays)
      if (n >= 1 && n <= 365) lookbackDays = n
    } else if (j.lookbackDays === null) {
      lookbackDays = null
    }
    const dk: EmailSyncDocumentKind =
      j.documentKind === 'fornitore' ||
      j.documentKind === 'bolla' ||
      j.documentKind === 'fattura' ||
      j.documentKind === 'estratto_conto'
        ? j.documentKind
        : 'all'
    return { mode, fiscalYear: fy, lookbackDays, documentKind: dk }
  } catch {
    return defaultPrefs()
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
  email_sync_lookback_days?: number
} {
  if (prefs.mode === 'fiscal_year') {
    return { email_sync_scope: 'fiscal_year', fiscal_year: prefs.fiscalYear }
  }
  if (prefs.lookbackDays != null && prefs.lookbackDays >= 1 && prefs.lookbackDays <= 365) {
    return { email_sync_scope: 'lookback', email_sync_lookback_days: prefs.lookbackDays }
  }
  return { email_sync_scope: 'lookback' }
}

/** Preferenze date + tipologia documento per una richiesta di sync. */
export function emailSyncApiBodyFields(prefs: EmailSyncScopePrefs): {
  email_sync_scope: EmailSyncScopeMode
  fiscal_year?: number
  email_sync_lookback_days?: number
  email_sync_document_kind?: EmailSyncDocumentKind
  /** Allinea alla finestra giorni sede / override (sync «storica» da UI). */
  mode: 'historical'
} {
  const base = emailSyncScopeBodyFields(prefs)
  if (prefs.documentKind && prefs.documentKind !== 'all') {
    return { ...base, email_sync_document_kind: prefs.documentKind, mode: 'historical' }
  }
  return { ...base, mode: 'historical' }
}
