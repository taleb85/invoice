'use client'

import { useState } from 'react'
import { exportToExcel, exportToPdf, type ExportRow, type ExportType } from '@/lib/export-report'
import { iconAccentClass as icon } from '@/lib/icon-accent-classes'
import { BTN_SIZE_SM } from '@/lib/button-size-tokens'

interface ExportButtonProps {
  rows: ExportRow[]
  type: ExportType
  period: string
  className?: string
}

export function ExportButton({ rows, type, period, className = '' }: ExportButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<'pdf' | 'excel' | null>(null)

  const handleExcel = () => {
    setLoading('excel')
    try {
      exportToExcel(rows, type, period)
    } finally {
      setLoading(null)
      setOpen(false)
    }
  }

  const handlePdf = async () => {
    setLoading('pdf')
    try {
      await exportToPdf(rows, type, period)
    } finally {
      setLoading(null)
      setOpen(false)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 border border-app-line-30 bg-app-line-10 text-app-fg-muted transition-colors hover:border-app-a-45 hover:text-app-fg ${BTN_SIZE_SM}`}
      >
        <svg className={`h-4 w-4 ${icon.settingsTools}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Esporta
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-xl 
            border border-app-line-30 bg-slate-900 shadow-xl overflow-hidden">
            <button
              onClick={handleExcel}
              disabled={loading !== null}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-sm 
                text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg 
                transition-colors disabled:opacity-50"
            >
              <span className="text-green-400">📊</span>
              {loading === 'excel' ? 'Esportando...' : 'Excel (.xlsx)'}
            </button>
            <button
              onClick={handlePdf}
              disabled={loading !== null}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-sm 
                text-app-fg-muted hover:bg-app-line-10 hover:text-app-fg 
                transition-colors disabled:opacity-50 border-t border-app-line-15"
            >
              <span className="text-red-400">📄</span>
              {loading === 'pdf' ? 'Esportando...' : 'PDF (.pdf)'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
