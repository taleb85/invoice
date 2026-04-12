'use client'

import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/use-t'

export type ManualDeliveryFormProps = {
  fornitoreId: string
  sedeId?: string | null
  languageHint?: string
  /** Classi aggiuntive sul wrapper del form */
  className?: string
  onSuccess?: (statementId: string) => void
  onError?: (message: string) => void
}

const inputCls =
  'mb-3 w-full resize-y rounded-lg border border-slate-600/60 bg-slate-800/70 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-shadow disabled:opacity-60'

/** Mobile-first: testo libero e/o foto + "Registra Consegna". */
export default function ManualDeliveryForm({
  fornitoreId,
  sedeId,
  languageHint,
  className = '',
  onSuccess,
  onError,
}: ManualDeliveryFormProps) {
  const t = useT()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [localOk, setLocalOk] = useState<string | null>(null)

  useEffect(() => {
    if (!preview) return
    return () => URL.revokeObjectURL(preview)
  }, [preview])

  function applyImageFile(f: File | null) {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    if (!f || !f.type.startsWith('image/')) {
      setPhotoFile(null)
      return
    }
    setPhotoFile(f)
    setPreview(URL.createObjectURL(f))
  }

  function clearPhoto() {
    applyImageFile(null)
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError(null)
    setLocalOk(null)
    const trimmed = text.trim()
    if (!trimmed && !photoFile) {
      const msg = t.dashboard.manualReceiptNeedTextOrPhoto
      setLocalError(msg)
      onError?.(msg)
      return
    }
    if (!fornitoreId) {
      const msg = t.dashboard.manualReceiptNeedSupplier
      setLocalError(msg)
      onError?.(msg)
      return
    }
    setLoading(true)
    try {
      let res: Response
      if (photoFile) {
        const fd = new FormData()
        fd.append('fornitoreId', fornitoreId)
        if (sedeId != null && sedeId !== '') fd.append('sedeId', sedeId)
        if (languageHint) fd.append('languageHint', languageHint)
        fd.append('text', trimmed)
        fd.append('file', photoFile)
        res = await fetch('/api/manual-delivery', { method: 'POST', body: fd })
      } else {
        res = await fetch('/api/manual-delivery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: trimmed,
            fornitoreId,
            sedeId: sedeId ?? null,
            languageHint,
          }),
        })
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string
        statementId?: string
      }
      if (!res.ok) {
        const msg = data.error ?? t.dashboard.manualReceiptRegisterFailed
        setLocalError(msg)
        onError?.(msg)
        return
      }
      if (data.statementId) {
        setLocalOk(t.dashboard.manualReceiptSaved)
        setText('')
        clearPhoto()
        onSuccess?.(data.statementId)
      }
    } catch {
      const msg = t.ui.networkError
      setLocalError(msg)
      onError?.(msg)
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = Boolean(fornitoreId && (text.trim() || photoFile))

  return (
    <form onSubmit={handleSubmit} className={`app-card overflow-hidden ${className}`}>
      <div className="app-card-bar" aria-hidden />
      <div className="p-4 md:p-5">
        <label
          htmlFor="manual-delivery-text"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400"
        >
          {t.dashboard.manualReceiptLabel}
        </label>
        <textarea
          id="manual-delivery-text"
          name="manualDeliveryText"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
          placeholder={t.dashboard.manualReceiptPlaceholder}
          className={inputCls}
          autoComplete="off"
          enterKeyHint="done"
        />

        <p className="mb-2 text-[11px] text-slate-500">{t.bolle.takePhotoOrFile}</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              applyImageFile(f)
              e.target.value = ''
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null
              applyImageFile(f)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={loading}
            onClick={() => cameraRef.current?.click()}
            className="touch-manipulation rounded-lg border border-slate-600/70 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700/80 disabled:opacity-50"
          >
            {t.bolle.cameraBtn}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => fileRef.current?.click()}
            className="touch-manipulation rounded-lg border border-slate-600/70 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700/80 disabled:opacity-50"
          >
            {t.bolle.fileBtn}
          </button>
          {photoFile ? (
            <button
              type="button"
              disabled={loading}
              onClick={clearPhoto}
              className="touch-manipulation rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-200 transition-colors hover:bg-red-900/50 disabled:opacity-50"
            >
              {t.dashboard.manualReceiptRemovePhoto}
            </button>
          ) : null}
        </div>
        {preview ? (
          <div className="mb-3 overflow-hidden rounded-lg border border-slate-600/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="max-h-40 w-full object-contain bg-slate-900/50" />
          </div>
        ) : null}

        {localError ? (
          <p className="mb-2 text-xs font-medium text-red-400" role="alert">
            {localError}
          </p>
        ) : null}
        {localOk ? (
          <p className="mb-2 text-xs font-medium text-emerald-400" role="status">
            {localOk}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="min-h-[48px] w-full touch-manipulation rounded-lg bg-cyan-500 px-4 py-3 text-xs font-bold text-white transition-colors hover:bg-cyan-400 active:bg-cyan-600 disabled:opacity-50"
        >
          {loading ? t.dashboard.manualReceiptRegistering : t.dashboard.manualReceiptRegister}
        </button>
      </div>
    </form>
  )
}
