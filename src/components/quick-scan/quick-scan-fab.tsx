'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { useMe } from '@/lib/me-context'
import type { QuickScanResult } from './quick-scan-modal'

const QuickScanModal = dynamic(
  () => import('./quick-scan-modal').then((m) => m.QuickScanModal),
  { ssr: false },
)

export function QuickScanFab() {
  const [open, setOpen] = useState(false)
  const { me } = useMe()

  async function handleConfirm(result: QuickScanResult, file: File) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('tipo', result.tipo)
    formData.append('fornitore_id', result.fornitore_id ?? '')
    formData.append('importo', String(result.importo ?? ''))
    formData.append('data', result.data ?? '')
    formData.append('numero', result.numero ?? '')
    formData.append('sede_id', me?.sede_id ?? '')

    await fetch('/api/quick-scan/save', { method: 'POST', body: formData })
  }

  // Only show for authenticated users with a sede
  if (!me) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full
          bg-[#22d3ee] shadow-[0_0_20px_rgba(34,211,238,0.4)]
          flex items-center justify-center
          active:scale-95 transition-transform
          md:hidden"
        aria-label="Scansione rapida"
      >
        <svg
          className="w-6 h-6 text-[#0a192f]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      </button>

      {open && (
        <QuickScanModal
          onClose={() => setOpen(false)}
          onConfirm={handleConfirm}
          sedeId={me?.sede_id ?? null}
        />
      )}
    </>
  )
}
