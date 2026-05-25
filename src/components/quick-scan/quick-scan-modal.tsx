'use client'
import { useRef, useState, useEffect } from 'react'
import { GlyphWarningTriangle } from '@/components/ui/glyph-icons'
import { useT } from '@/lib/use-t'

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

function QuickScanModal({ onClose, onConfirm, sedeId }: QuickScanModalProps) {
  const t = useT()
  const q = t.quickScan
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [phase, setPhase] = useState<'camera' | 'processing' | 'confirm' | 'error'>('camera')
  const [result, setResult] = useState<QuickScanResult | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  /** Consente di correggere bolla↔fattura se l’OCR ha classificato male. */
  const [selectedTipo, setSelectedTipo] = useState<QuickScanResult['tipo']>('bolla')

  useEffect(() => {
    startCamera()
    return () => stopCamera()
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
      setErrorMsg(q.cameraError)
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
      if (!res.ok) throw new Error(q.ocrFailed)
      const data = (await res.json()) as QuickScanResult
      setResult(data)
      setSelectedTipo(data.tipo === 'unknown' ? 'bolla' : data.tipo)
      setPhase('confirm')
    } catch {
      setErrorMsg(q.ocrError)
      setPhase('error')
    }
  }

  async function handleConfirm() {
    if (!result || !capturedFile) return
    setSaving(true)
    try {
      await onConfirm({ ...result, tipo: selectedTipo }, capturedFile)
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
              <div className="w-[85%] max-w-sm aspect-[3/4] border-2 border-sky-400 rounded-2xl" />
            </div>

            <div className="absolute top-4 left-0 right-0 text-center">
              <p className="text-app-fg-muted text-sm">{q.frameDocument}</p>
            </div>
          </div>

          <div className="bg-black pb-safe px-6 py-6 flex items-center justify-between">
            {/* File upload fallback */}
            <label className="flex flex-col items-center gap-1 cursor-pointer">
              <div className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-app-fg-subtle text-xs">{q.galleryButton}</span>
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
              className="w-20 h-20 rounded-full bg-[#38bdf8] flex items-center justify-center shadow-[0_0_30px_rgba(56,189,248,0.45)]"
            >
              <div className="w-16 h-16 rounded-full border-4 border-black/20" />
            </button>

            {/* Close */}
            <button onClick={onClose} className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="text-app-fg-subtle text-xs">{q.closeButton}</span>
            </button>
          </div>
        </>
      )}

      {phase === 'processing' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-16 h-16 rounded-full border-4 border-[#38bdf8] border-t-transparent animate-spin" />
          <p className="text-app-fg-muted">{q.processingTitle}</p>
          <p className="text-app-fg-subtle text-xs">{q.processingSubtitle}</p>
        </div>
      )}

      {phase === 'confirm' && result && (
        <div className="flex-1 flex flex-col app-workspace-inset-bg-soft bg-slate-950/40">
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
                  ? q.typeFattura
                  : result.tipo === 'bolla'
                    ? q.typeBolla
                    : q.typeUnknown}
              </div>
              <span className="text-app-fg-subtle text-xs">{q.autoRecognized}</span>
            </div>
            <h2 className="text-white text-xl font-medium mt-2">{q.extractedData}</h2>
            <p className="mt-3 text-app-fg-subtle text-xs leading-snug">
              {q.chooseTypeHint}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedTipo('bolla')}
                className={`min-h-[44px] flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors touch-manipulation ${
                  selectedTipo === 'bolla'
                    ? 'border-sky-400/70 bg-sky-400/15 text-sky-100'
                    : 'border-white/15 bg-white/5 text-app-fg-muted hover:border-white/25'
                }`}
              >
                {q.typeBolla}
              </button>
              <button
                type="button"
                onClick={() => setSelectedTipo('fattura')}
                className={`min-h-[44px] flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors touch-manipulation ${
                  selectedTipo === 'fattura'
                    ? 'border-violet-400/50 bg-violet-500/20 text-violet-200'
                    : 'border-white/15 bg-white/5 text-app-fg-muted hover:border-white/25'
                }`}
              >
                {q.typeFattura}
              </button>
            </div>
          </div>

          <div className="flex-1 px-6 space-y-3">
            {[
              { label: q.fieldFornitore, value: result.fornitore ?? q.fornitoreUnrecognized },
              {
                label: q.fieldImporto,
                value: result.importo != null ? `£${result.importo.toFixed(2)}` : '—',
              },
              { label: q.fieldData, value: result.data ?? '—' },
              { label: q.fieldNumero, value: result.numero ?? '—' },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex justify-between items-center py-3 border-b border-white/10"
              >
                <span className="text-app-fg-subtle text-sm">{label}</span>
                <span className="text-white font-medium text-sm">{value}</span>
              </div>
            ))}
          </div>

          <div className="px-6 pb-safe py-6 flex gap-3">
            <button
              onClick={() => startCamera()}
              className="flex-1 py-3 rounded-xl border border-white/20 text-app-fg-muted text-sm"
            >
              {q.retry}
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className="flex-1 py-3 rounded-xl bg-[#38bdf8] text-slate-950 font-semibold text-sm disabled:opacity-50"
            >
              {saving ? q.savingState : q.saveCta}
            </button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
          <GlyphWarningTriangle className="h-14 w-14 text-amber-400" aria-hidden />
          <p className="text-white text-center">{errorMsg}</p>
          <div className="flex gap-3">
            <button
              onClick={() => startCamera()}
              className="px-6 py-3 rounded-xl bg-[#38bdf8] text-slate-950 font-semibold"
            >
              {q.retry}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 rounded-xl border border-white/20 text-app-fg-muted"
            >
              {q.closeButton}
            </button>
          </div>
          {/* File upload fallback when camera fails */}
          <label className="mt-2 cursor-pointer">
            <span className="text-[#38bdf8] text-sm underline underline-offset-2">
              {q.fallbackUpload}
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

export { QuickScanModal }
export default QuickScanModal
