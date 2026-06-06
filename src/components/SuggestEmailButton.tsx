'use client'

import { useRef, useState } from 'react'
import { useT } from '@/lib/use-t'
import type { EmailSuggestion } from '@/app/api/fornitori/[id]/suggest-email/route'

interface Props {
  fornitoreId: string
  /** Nome fornitore — mostrato durante la scansione IMAP per nome. */
  fornitoreNome?: string
  /** Called after an email is successfully saved as an alias */
  onSaved?: (email: string) => void
}

function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`))
}

const SOURCE_ICONS: Record<EmailSuggestion['source'], string> = {
  log: '📋',
  queue: '📥',
  unmatched_queue: '🔍',
  inbox_from: '📧',
  inbox_reply_to: '↩️',
  inbox_body: '📝',
}

export default function SuggestEmailButton({ fornitoreId, fornitoreNome, onSaved }: Props) {
  const t = useT()
  const s = t.appStrings

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<EmailSuggestion[] | null>(null)
  const [billingPlatformOnly, setBillingPlatformOnly] = useState(false)
  const [inboxError, setInboxError] = useState<string | null>(null)
  const [inboxScanSummary, setInboxScanSummary] = useState<string | null>(null)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const panelRef = useRef<HTMLDivElement>(null)

  async function handleSearch() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    setLoading(true)
    setInboxError(null)
    setInboxScanSummary(null)
    try {
      const res = await fetch(`/api/fornitori/${fornitoreId}/suggest-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scan_inbox: true }),
      })
      if (!res.ok) throw new Error(await res.text())
      const json = await res.json()
      setSuggestions(json.suggestions ?? [])
      setBillingPlatformOnly(json.billing_platform_only === true)
      setInboxError(typeof json.inbox_error === 'string' ? json.inbox_error : null)
      if (json.scanned_inbox === true && Array.isArray(json.inbox_search_terms)) {
        const terms = (json.inbox_search_terms as string[]).join(', ')
        const n = typeof json.inbox_mails_matched === 'number' ? json.inbox_mails_matched : 0
        const days = typeof json.inbox_lookback_days === 'number' ? json.inbox_lookback_days : 90
        setInboxScanSummary(
          fillTemplate(s.suggestEmailInboxScanSummary, { n, terms, days }),
        )
      }
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
    if (source === 'unmatched_queue') return s.suggestEmailSourceUnmatched
    if (source === 'inbox_from') return s.suggestEmailSourceInboxFrom
    if (source === 'inbox_reply_to') return s.suggestEmailSourceInboxReplyTo
    return s.suggestEmailSourceInboxBody
  }

  function inboxErrorLabel(code: string) {
    if (code === 'sede_missing') return s.suggestEmailInboxErrorNoSede
    if (code === 'imap_not_configured') return s.suggestEmailInboxErrorNoImap
    if (code === 'imap_decrypt_failed') return s.suggestEmailInboxErrorDecrypt
    if (code === 'name_too_short') return s.suggestEmailInboxErrorName
    return s.suggestEmailInboxErrorGeneric
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleSearch}
        title={fornitoreNome ? fillTemplate(s.suggestEmailSearching, { name: fornitoreNome }) : s.suggestEmailTitle}
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
          className="absolute left-0 z-50 mt-1.5 w-80 rounded-xl border border-white/10 shadow-2xl ring-1 ring-black/50"
          style={{ backgroundColor: '#1c1c1e' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 rounded-t-xl" style={{ backgroundColor: '#252528' }}>
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
                {fillTemplate(s.suggestEmailSearching, { name: fornitoreNome ?? '…' })}
              </div>
            )}

            {!loading && suggestions !== null && suggestions.length === 0 && (
              <div className="space-y-2 py-4 px-1 text-center text-xs text-app-fg-muted">
                <p>
                  {billingPlatformOnly ? s.suggestEmailBillingPlatformOnly : s.suggestEmailNoResults}
                </p>
                {inboxError && inboxError !== 'sede_missing' && (
                  <p className="text-[10px] text-amber-400/90">{inboxErrorLabel(inboxError)}</p>
                )}
              </div>
            )}

            {!loading && suggestions !== null && suggestions.length > 0 && (
              <ul className="space-y-1">
                {suggestions.map(sg => (
                  <li
                    key={sg.email}
                    className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 hover:bg-white/5"
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
                        className="shrink-0 rounded-md border border-[rgba(34,211,238,0.15)] bg-emerald-950/35 px-2 py-1 text-[10px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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
            {!loading && inboxScanSummary && (
              <p className="mt-2 border-t border-white/10 pt-2 text-[10px] text-cyan-300/90">
                {inboxScanSummary}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
