/**
 * Cronologia cicli «Analizza con AI» (Gemini classify) nell’AI Inbox.
 * Solo browser / localStorage — per ricontrollo visivo; non sincronizzata né audit server.
 */

export type InboxGeminiHistoryOutcome =
  | 'auto_discarded'
  | 'registered'
  /** Suggerimento presente sulla riga, nessuno scarto / finalizza automatico in questo run */
  | 'classification_only'
  /** Risposta con `error` o download fallito (vedi campo error) */
  | 'classification_error'

export type InboxGeminiHistoryLine = {
  doc_id: string
  file_label: string
  tipo_suggerito: string
  confidenza: number
  outcome: InboxGeminiHistoryOutcome
  /** Se outcome === registered */
  registered_kind?: string
  classify_error?: string | null
  azione_breve?: string | null
}

export type InboxGeminiHistoryRun = {
  at_ms: number
  sede_id: string
  lines: InboxGeminiHistoryLine[]
}

const STORAGE_KEY = 'inbox-ai-gemini-history-v1'
const MAX_RUNS_PER_SEDE = 35

type Store = Record<string, InboxGeminiHistoryRun[]>

function readStore(): Store {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const p = JSON.parse(raw) as unknown
    if (!p || typeof p !== 'object' || Array.isArray(p)) return {}
    return p as Store
  } catch {
    return {}
  }
}

function writeStore(data: Store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    /* quota / private mode */
  }
}

/** Elenco cicli dalla più recente. */
export function loadInboxGeminiHistoryRuns(sedeId: string | null): InboxGeminiHistoryRun[] {
  if (!sedeId) return []
  const all = readStore()
  const list = all[sedeId]
  if (!Array.isArray(list)) return []
  return [...list].sort((a, b) => b.at_ms - a.at_ms)
}

export function pushInboxGeminiHistoryRun(run: InboxGeminiHistoryRun): void {
  if (typeof window === 'undefined') return
  const sid = run.sede_id?.trim()
  if (!sid || run.lines.length === 0) return
  const all = readStore()
  const prev = Array.isArray(all[sid]) ? all[sid]! : []
  const nextRuns = [{ ...run, at_ms: run.at_ms || Date.now() }, ...prev].slice(0, MAX_RUNS_PER_SEDE)
  all[sid] = nextRuns
  writeStore(all)
}

export function clearInboxGeminiHistoryForSede(sedeId: string | null): void {
  if (!sedeId || typeof window === 'undefined') return
  const all = readStore()
  delete all[sedeId]
  writeStore(all)
}
