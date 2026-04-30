'use client'

import { useState } from 'react'
import { COUNTRY_OPTIONS } from '@/lib/localization'
import { useT } from '@/lib/use-t'
import { LocaleCodeChip } from '@/components/ui/glyph-icons'

interface Props {
  sedeId: string
  initialCode: string
}

export default function CountrySelector({ sedeId, initialCode }: Props) {
  const t = useT()
  const [code, setCode]       = useState(initialCode)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const current = COUNTRY_OPTIONS.find(o => o.code === code) ?? COUNTRY_OPTIONS[0]

  async function save(newCode: string) {
    setCode(newCode)
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch(`/api/sedi/${sedeId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ country_code: newCode }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? t.ui.networkError)
        setCode(initialCode)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch {
      setError(t.ui.networkError)
      setCode(initialCode)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative">
        <select
          value={code}
          onChange={e => save(e.target.value)}
          disabled={saving}
          className="cursor-pointer appearance-none rounded-lg border border-app-line-25 app-workspace-surface-elevated py-1.5 pl-8 pr-7 text-sm text-app-fg focus:border-app-cyan-500 focus:outline-none focus:ring-2 focus:ring-app-line-30 disabled:opacity-50 [color-scheme:dark]"
        >
          {COUNTRY_OPTIONS.map(o => (
            <option key={o.code} value={o.code}>
              {o.code} — {o.name}
            </option>
          ))}
        </select>
        {/* Flag overlay */}
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 leading-none">
          <LocaleCodeChip code={current.code} className="h-6 min-w-[1.75rem] px-1 text-[9px]" />
        </span>
        {/* Chevron */}
        <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {saving && (
        <span className="text-xs text-app-fg-muted flex items-center gap-1">
          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          {t.appStrings.countrySaving}
        </span>
      )}
      {saved && (
        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
          {t.appStrings.countrySaved}
        </span>
      )}
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  )
}
