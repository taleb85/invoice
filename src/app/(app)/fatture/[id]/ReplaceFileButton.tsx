'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  fatturaId: string
}

export default function ReplaceFileButton({ fatturaId }: Props) {
  const router = useRouter()
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

    if (file.type === 'application/pdf') {
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
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {!open && !loading && status !== 'done' && (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm font-medium text-app-cyan-500 transition-colors hover:text-app-fg-muted"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Sostituisci file
        </button>
      )}

      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <button
            onClick={() => { setOpen(false); setTimeout(() => fileRef.current?.click(), 50) }}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-app-line-25 py-5 text-app-fg-muted transition-colors hover:border-app-line-50 hover:text-app-cyan-500 active:brightness-95"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-medium">Scegli PDF</span>
          </button>
          <button
            onClick={() => setOpen(false)}
            className="py-1 text-xs text-app-fg-muted transition-colors hover:text-app-fg"
          >
            Annulla
          </button>
        </div>
      )}

      {loading && (
        <p className="mt-2 flex items-center gap-2 text-sm text-app-fg-muted">
          <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {statusLabel[status]}
        </p>
      )}

      {status === 'done' && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-emerald-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          File aggiornato con successo
        </p>
      )}

      {status === 'error' && (
        <p className="mt-2 text-sm text-red-400">{error}</p>
      )}
    </div>
  )
}
