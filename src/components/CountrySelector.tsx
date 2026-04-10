'use client'

import { useState } from 'react'
import { COUNTRY_OPTIONS } from '@/lib/localization'

interface Props {
  sedeId: string
  initialCode: string
}

export default function CountrySelector({ sedeId, initialCode }: Props) {
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
        setError(d.error ?? 'Si è verificato un errore.')
        setCode(initialCode)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } catch {
      setError('Si è verificato un errore di rete.')
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
          className="appearance-none pl-8 pr-7 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#1a3050]/30 focus:border-[#1a3050] disabled:opacity-50 cursor-pointer"
        >
          {COUNTRY_OPTIONS.map(o => (
            <option key={o.code} value={o.code}>
              {o.flag} {o.name}
            </option>
          ))}
        </select>
        {/* Flag overlay */}
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-base leading-none">
          {current.flag}
        </span>
        {/* Chevron */}
        <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {saving && (
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
          Salvataggio…
        </span>
      )}
      {saved && (
        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
          </svg>
          Salvato
        </span>
      )}
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  )
}
