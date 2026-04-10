'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  fatturaId: string
}

export default function ReplaceFileButton({ fatturaId }: Props) {
  const router = useRouter()
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ocr' | 'upload' | 'done' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setOpen(false)
    setLoading(true)
    setError(null)
    setStatus('ocr')

    let dataFattura: string | null = null

    // OCR solo su immagini
    if (file.type.startsWith('image/')) {
      try {
        const ocrForm = new FormData()
        ocrForm.append('file', file)
        const ocrRes = await fetch('/api/ocr-fattura', { method: 'POST', body: ocrForm })
        if (ocrRes.ok) {
          const ocrData = await ocrRes.json()
          dataFattura = ocrData.data ?? null
        }
      } catch {
        // OCR fallita, si continua senza data
      }
    }

    setStatus('upload')

    const form = new FormData()
    form.append('fattura_id', fatturaId)
    form.append('file', file)
    if (dataFattura) form.append('data', dataFattura)

    const res = await fetch('/api/fatture/replace-file', { method: 'POST', body: form })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Errore sconosciuto')
      setStatus('error')
      setLoading(false)
      return
    }

    setStatus('done')
    setLoading(false)
    router.refresh()
  }

  const statusLabel: Record<typeof status, string> = {
    idle: '',
    ocr: 'Analisi documento…',
    upload: 'Caricamento…',
    done: 'File sostituito!',
    error: error ?? 'Errore',
  }

  return (
    <div className="mt-4">
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {!open && !loading && status !== 'done' && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm text-[#1a3050] font-medium hover:opacity-75 transition-opacity"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Sostituisci file
        </button>
      )}

      {open && (
        <div className="grid grid-cols-2 gap-3 mt-2">
          <button
            onClick={() => { setOpen(false); setTimeout(() => cameraRef.current?.click(), 50) }}
            className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-5 text-gray-400 hover:border-[#2a4a7f] hover:text-[#2a4a7f] transition-colors active:bg-[#e8edf5]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs font-medium">Fotocamera</span>
          </button>
          <button
            onClick={() => { setOpen(false); setTimeout(() => fileRef.current?.click(), 50) }}
            className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-5 text-gray-400 hover:border-[#2a4a7f] hover:text-[#2a4a7f] transition-colors active:bg-[#e8edf5]"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs font-medium">Scegli file</span>
          </button>
          <button
            onClick={() => setOpen(false)}
            className="col-span-2 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            Annulla
          </button>
        </div>
      )}

      {loading && (
        <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {statusLabel[status]}
        </p>
      )}

      {status === 'done' && (
        <p className="text-sm text-green-600 font-medium mt-2 flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          File aggiornato con successo
        </p>
      )}

      {status === 'error' && (
        <p className="text-sm text-red-500 mt-2">{error}</p>
      )}
    </div>
  )
}
