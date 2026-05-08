'use client'

import { type RefObject } from 'react'
import { useT } from '@/lib/use-t'

export type OcrStatus = 'idle' | 'scanning' | 'matched' | 'not_found' | 'error'

interface ScannerFileUploadSectionProps {
  file: File | null
  scanPreviewUrl: string | null
  ocrStatus: OcrStatus
  fileRef: RefObject<HTMLInputElement | null>
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onOpenCamera: () => void
  onRemoveFile: () => void
}

export default function ScannerFileUploadSection({
  file,
  scanPreviewUrl,
  ocrStatus,
  fileRef,
  onFileSelect,
  onOpenCamera,
  onRemoveFile,
}: ScannerFileUploadSectionProps) {
  const t = useT()

  return (
    <div className="app-card overflow-hidden">
      <div className="border-t border-app-line-10 app-workspace-inset-bg p-4">
        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-app-fg-muted">
          {t.bolle.fotoLabel}
        </label>

        {!file && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-app-tint-300-45 py-5 text-app-fg-muted transition-colors hover:border-app-tint-300-45 hover:bg-app-line-10 hover:text-app-fg active:bg-app-line-15 sm:py-6"
            >
              <svg className="h-8 w-8 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="text-center text-sm font-bold tracking-tight">{t.bolle.fileBtn} (PDF)</span>
            </button>
            <button
              type="button"
              onClick={onOpenCamera}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-app-tint-300-45 py-5 text-app-fg-muted transition-colors hover:border-app-tint-300-45 hover:bg-app-line-10 hover:text-app-fg active:bg-app-line-15 sm:py-6"
            >
              <svg className="h-8 w-8 text-app-fg-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-center text-sm font-bold tracking-tight">{t.bolle.cameraBtn}</span>
            </button>
          </div>
        )}

        {file && (
          <div className="relative rounded-xl border border-app-line-25 app-workspace-inset-bg-soft px-3 py-6 text-center text-sm font-semibold text-app-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-app-line-10">
            {scanPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={scanPreviewUrl}
                alt=""
                className="mx-auto mb-3 max-h-[min(50vh,280px)] w-full rounded-lg border border-app-soft-border object-contain"
              />
            ) : null}
            <p>{file.type === 'application/pdf' ? t.bolle.scannerPdfPreview : t.bolle.scannerImageAttached}</p>
            <p className="mt-1.5 truncate text-xs font-medium text-app-fg-muted">{file.name}</p>
            <button
              type="button"
              onClick={onRemoveFile}
              className="mt-3 text-xs font-bold text-red-300 underline decoration-red-400/50 underline-offset-2 hover:text-red-200"
            >
              {t.common.delete}
            </button>
            {ocrStatus === 'scanning' && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-app-fg-muted">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                {t.bolle.ocrAnalyzing}
              </p>
            )}
            {ocrStatus === 'matched' && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-200">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
                </svg>
                {t.bolle.ocrMatched}
              </p>
            )}
            {ocrStatus === 'not_found' && (
              <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-bold text-amber-200">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                {t.bolle.ocrNotFound}
              </p>
            )}
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          onChange={onFileSelect}
          className="hidden"
        />
      </div>
    </div>
  )
}
