'use client'

import { useState } from 'react'

const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

export default function ExportZipButton() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [loading, setLoading] = useState(false)

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i)

  const handleExport = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/export-zip?year=${year}&month=${month}`)
      if (!res.ok) { alert('Errore durante la generazione dello ZIP.'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `FLUXO_${year}-${String(month).padStart(2, '0')}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
      <select
        value={month}
        onChange={(e) => setMonth(Number(e.target.value))}
        className="flex-1 md:flex-none text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent bg-white"
      >
        {MESI.map((m, i) => (
          <option key={i + 1} value={i + 1}>{m}</option>
        ))}
      </select>

      <select
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent bg-white shrink-0"
      >
        {years.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>

      <button
        onClick={handleExport}
        disabled={loading}
        className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {loading ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Generazione…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Scarica ZIP
          </>
        )}
      </button>
    </div>
  )
}
