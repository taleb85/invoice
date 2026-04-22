'use client'

import { useRef, useState } from 'react'
import { useT } from '@/lib/use-t'
import type { EmailSuggestion } from '@/app/api/fornitori/[id]/suggest-email/route'

interface Props {
  fornitoreId: string
  /** Called after an email is successfully saved as an alias */
  onSaved?: (email: string) => void
}

const SOURCE_ICONS: Record<EmailSuggestion['source'], string> = {
  log: '📋',
  queue: '📥',
  unmatched_queue: '🔍',
}

export default function SuggestEmailButton({ fornitoreId, onSaved }: Props) {
  const t = useT()
  const s = t.appStrings

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<EmailSuggestion[] | null>(null)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const panelRef = useRef<HTMLDivElement>(null)

  async function handleSearch() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (suggestions !== null) return // already loaded
    setLoading(true)
    try {
      const res = await fetch(`/api/fornitori/${fornitoreId}/suggest-email`)
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setSuggestions(json.suggestions ?? [])
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(email: string) {
    setSaving(prev => ({ ...prev, [email]: true }))
    try {
      const res = await fetch('/api/fornitore-emails/remember', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fornitore_id: fornitoreId, email }),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaved(prev => ({ ...prev, [email]: true }))
      onSaved?.(email)
    } finally {
      setSaving(prev => ({ ...prev, [email]: false }))
    }
  }

  function sourceLabel(source: EmailSuggestion['source']) {
    if (source === 'log') return s.suggestEmailSourceLog
    if (source === 'queue') return s.suggestEmailSourceQueue
    return s.suggestEmailSourceUnmatched
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleSearch}
        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/35 px-2.5 py-1.5 text-[11px] font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
      >
        <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {s.suggestEmailBtn}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute left-0 z-50 mt-1.5 w-80 rounded-xl border border-app-line-22 bg-app-surface-elevated shadow-2xl ring-1 ring-black/30"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-app-line-15 px-3 py-2">
            <p className="text-[11px] font-semibold text-app-fg">{s.suggestEmailTitle}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-app-fg-muted hover:text-app-fg"
              aria-label="Chiudi"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="max-h-64 overflow-y-auto p-2">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-app-fg-muted">
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {s.suggestEmailSearching}
              </div>
            )}

            {!loading && suggestions !== null && suggestions.length === 0 && (
              <p className="py-5 text-center text-xs text-app-fg-muted">{s.suggestEmailNoResults}</p>
            )}

            {!loading && suggestions !== null && suggestions.length > 0 && (
              <ul className="space-y-1">
                {suggestions.map(sg => (
                  <li
                    key={sg.email}
                    className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-app-line-10/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-app-fg">{sg.email}</p>
                      <p className="mt-0.5 text-[10px] text-app-fg-muted">
                        {SOURCE_ICONS[sg.source]} {sourceLabel(sg.source)}
                        {sg.count > 1 && (
                          <span className="ml-1 rounded-full bg-app-line-22 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-app-fg-muted">
                            ×{sg.count}
                          </span>
                        )}
                      </p>
                    </div>

                    {saved[sg.email] ? (
                      <span className="shrink-0 text-[10px] font-semibold text-emerald-400">
                        {s.suggestEmailSaved} ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={saving[sg.email]}
                        onClick={() => handleSave(sg.email)}
                        className="shrink-0 rounded-md border border-emerald-500/40 bg-emerald-950/35 px-2 py-1 text-[10px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving[sg.email] ? (
                          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : s.suggestEmailSave}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
