'use client'
import { useRef, useState, useEffect } from 'react'

export type QuickScanResult = {
  tipo: 'bolla' | 'fattura' | 'unknown'
  fornitore: string | null
  importo: number | null
  data: string | null
  numero: string | null
  fornitore_id: string | null
}

type QuickScanModalProps = {
  onClose: () => void
  onConfirm: (result: QuickScanResult, file: File) => Promise<void>
  sedeId: string | null
}

export function QuickScanModal({ onClose, onConfirm, sedeId }: QuickScanModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<'camera' | 'processing' | 'confirm' | 'error'>('camera')
  const [result, setResult] = useState<QuickScanResult | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startCamera() {
    setPhase('camera')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setPhase('error')
      setErrorMsg('Impossibile accedere alla fotocamera. Usa il caricamento file.')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function capture() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob(
      async (blob) => {
        if (!blob) return
        const file = new File([blob], `scan-${Date.now()}.jpg`, { type: 'image/jpeg' })
        setCapturedFile(file)
        stopCamera()
        await processFile(file)
      },
      'image/jpeg',
      0.92,
    )
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCapturedFile(file)
    stopCamera()
    await processFile(file)
  }

  async function processFile(file: File) {
    setPhase('processing')
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (sedeId) formData.append('sede_id', sedeId)

      const res = await fetch('/api/quick-scan/ocr', { method: 'POST', body: formData })
      if (!res.ok) throw new Error('OCR fallito')
      const data = (await res.json()) as QuickScanResult
      setResult(data)
      setPhase('confirm')
    } catch {
      setErrorMsg('Errore nel riconoscimento. Riprova.')
      setPhase('error')
    }
  }

  async function handleConfirm() {
    if (!result || !capturedFile) return
    setSaving(true)
    try {
      await onConfirm(result, capturedFile)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {phase === 'camera' && (
        <>
          <div className="relative flex-1 overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />

            {/* Document frame overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[85%] max-w-sm aspect-[3/4] border-2 border-[#22d3ee] rounded-2xl" />
            </div>

            <div className="absolute top-4 left-0 right-0 text-center">
              <p className="text-white/70 text-sm">Inquadra il documento</p>
            </div>
          </div>

          <div className="bg-black pb-safe px-6 py-6 flex items-center justify-between">
            {/* File upload fallback */}
            <label className="flex flex-col items-center gap-1 cursor-pointer">
              <div className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-white/50 text-xs">Galleria</span>
              <input
                type="file"
                className="hidden"
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
              />
            </label>

            {/* Capture button */}
            <button
              onClick={capture}
              className="w-20 h-20 rounded-full bg-[#22d3ee] flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.5)]"
            >
              <div className="w-16 h-16 rounded-full border-4 border-black/20" />
            </button>

            {/* Close */}
            <button onClick={onClose} className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="text-white/50 text-xs">Chiudi</span>
            </button>
          </div>
        </>
      )}

      {phase === 'processing' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-[#22d3ee] border-t-transparent animate-spin" />
          <p className="text-white/70">Analisi documento in corso...</p>
          <p className="text-white/40 text-xs">GPT-4o sta leggendo il documento</p>
        </div>
      )}

      {phase === 'confirm' && result && (
        <div className="flex-1 flex flex-col bg-[#0a192f]">
          <div className="px-6 pt-8 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <div
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  result.tipo === 'fattura'
                    ? 'bg-purple-500/20 text-purple-300'
                    : result.tipo === 'bolla'
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-gray-500/20 text-gray-300'
                }`}
              >
                {result.tipo === 'fattura'
                  ? 'Fattura'
                  : result.tipo === 'bolla'
                    ? 'Bolla / DDT'
                    : 'Documento'}
              </div>
              <span className="text-white/40 text-xs">riconosciuto automaticamente</span>
            </div>
            <h2 className="text-white text-xl font-medium mt-2">Dati estratti</h2>
          </div>

          <div className="flex-1 px-6 space-y-3">
            {[
              { label: 'Fornitore', value: result.fornitore ?? 'Non riconosciuto' },
              {
                label: 'Importo',
                value: result.importo != null ? `£${result.importo.toFixed(2)}` : '—',
              },
              { label: 'Data', value: result.data ?? '—' },
              { label: 'Numero', value: result.numero ?? '—' },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex justify-between items-center py-3 border-b border-white/10"
              >
                <span className="text-white/50 text-sm">{label}</span>
                <span className="text-white font-medium text-sm">{value}</span>
              </div>
            ))}
          </div>

          <div className="px-6 pb-safe py-6 flex gap-3">
            <button
              onClick={() => startCamera()}
              className="flex-1 py-3 rounded-xl border border-white/20 text-white/70 text-sm"
            >
              Riprova
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#22d3ee] text-[#0a192f] font-semibold text-sm disabled:opacity-50"
            >
              {saving ? 'Salvataggio...' : 'Conferma e salva'}
            </button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <div className="text-4xl">⚠️</div>
          <p className="text-white text-center">{errorMsg}</p>
          <div className="flex gap-3">
            <button
              onClick={() => startCamera()}
              className="px-6 py-3 rounded-xl bg-[#22d3ee] text-[#0a192f] font-semibold"
            >
              Riprova
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl border border-white/20 text-white/70"
            >
              Chiudi
            </button>
          </div>
          {/* File upload fallback when camera fails */}
          <label className="mt-2 cursor-pointer">
            <span className="text-[#22d3ee] text-sm underline underline-offset-2">
              Oppure carica un file
            </span>
            <input
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      )}
    </div>
  )
}
