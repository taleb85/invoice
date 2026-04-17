'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { useT } from '@/lib/use-t'

interface ImportedRow {
  'Product ID'?: string
  'Product Name'?: string
  'Price'?: string
  [key: string]: string | undefined
}

interface ImportSummary {
  updated: number
  created: number
  anomalies: Array<{
    prodotto: string
    rekki_product_id: string
    old_price: number
    new_price: number
    delta_pct: number
  }>
  errors: Array<{ row: number; error: string }>
}

export default function RekkiListinoImportSection({
  fornitoreId,
  fornitoreNome,
  rekkiLinked,
}: {
  fornitoreId: string
  fornitoreNome: string
  rekkiLinked: boolean
}) {
  const t = useT()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [showSummary, setShowSummary] = useState(false)
  const [previewRows, setPreviewRows] = useState<Array<{ productId: string; productName: string; price: string }>>([])
  const [showPreview, setShowPreview] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setShowSummary(false)
    setSummary(null)

    // Check file type
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
      setError('Formato file non valido. Usa CSV o Excel (.xlsx, .xls)')
      return
    }

    // Preview first rows
    const reader = new FileReader()
    
    if (file.name.match(/\.(xlsx|xls)$/i)) {
      // Excel file
      reader.onload = (event) => {
        try {
          const data = event.target?.result as ArrayBuffer
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          if (!sheetName) {
            setError('File Excel vuoto')
            return
          }
          
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json<ImportedRow>(worksheet, {
            raw: false,
            defval: '',
          })
          
          const preview = jsonData.slice(0, 5).map((row) => ({
            productId: row['Product ID']?.trim() || row['product_id']?.trim() || row['ProductID']?.trim() || '—',
            productName: row['Product Name']?.trim() || row['product_name']?.trim() || row['ProductName']?.trim() || '—',
            price: row['Price']?.trim() || row['price']?.trim() || row['prezzo']?.trim() || '—',
          }))

          setPreviewRows(preview)
          setShowPreview(true)
          setPendingFile(file)
        } catch (err) {
          setError(`Errore lettura Excel: ${err instanceof Error ? err.message : 'Errore sconosciuto'}`)
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      // CSV file
      reader.onload = (event) => {
        const text = event.target?.result as string
        const parsed = Papa.parse<ImportedRow>(text, {
          header: true,
          skipEmptyLines: true,
          preview: 5,
        })

        const preview = parsed.data.map((row) => ({
          productId: row['Product ID']?.trim() || row['product_id']?.trim() || '—',
          productName: row['Product Name']?.trim() || row['product_name']?.trim() || '—',
          price: row['Price']?.trim() || row['price']?.trim() || '—',
        }))

        setPreviewRows(preview)
        setShowPreview(true)
        setPendingFile(file)
      }
      reader.readAsText(file)
    }
  }

  const handleImport = async () => {
    if (!pendingFile) return

    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', pendingFile)
      formData.append('fornitore_id', fornitoreId)
      formData.append('data_prezzo', new Date().toISOString().split('T')[0])

      const res = await fetch('/api/listino/importa-da-rekki', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || `Errore ${res.status}`)
        setUploading(false)
        return
      }

      setSummary(data.result)
      setShowSummary(true)
      setShowPreview(false)
      setPendingFile(null)
      
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore durante l\'importazione')
    } finally {
      setUploading(false)
    }
  }

  const handleCancelPreview = () => {
    setShowPreview(false)
    setPendingFile(null)
    setPreviewRows([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (!rekkiLinked) {
    return null
  }

  return (
    <div className="supplier-detail-tab-shell overflow-hidden border-violet-500/25">
      <div className="app-card-bar-accent bg-gradient-to-r from-violet-500/80 to-fuchsia-500/60" aria-hidden />
      
      <div className="px-5 py-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-app-fg">Importa Listino Rekki</h3>
            <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">
              Carica un file CSV o Excel esportato da Rekki per aggiornare i prezzi in massa
            </p>
          </div>
          <svg className="h-6 w-6 shrink-0 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>

        {/* File input */}
        <div className="mb-3">
          <label className="block cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
            <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-violet-500/40 bg-violet-500/5 px-4 py-6 transition-colors hover:border-violet-500/60 hover:bg-violet-500/10">
              <svg className="h-5 w-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-medium text-violet-200">
                {uploading ? 'Importazione in corso...' : 'Click per selezionare CSV o Excel'}
              </span>
            </div>
          </label>
          <p className="mt-2 text-xs text-app-fg-muted">
            Il file deve contenere le colonne: <span className="font-semibold">Product ID</span>,{' '}
            <span className="font-semibold">Product Name</span>, <span className="font-semibold">Price</span>
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
            <div className="flex items-start gap-2">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Preview */}
        {showPreview && previewRows.length > 0 && (
          <div className="mb-3 rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
            <p className="mb-2 text-xs font-semibold text-violet-200">
              Anteprima file (prime {previewRows.length} righe):
            </p>
            <div className="mb-3 overflow-x-auto rounded border border-app-line-22">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-app-line-15">
                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase text-app-fg-muted">
                      Product ID
                    </th>
                    <th className="px-2 py-1.5 text-left text-[10px] font-semibold uppercase text-app-fg-muted">
                      Product Name
                    </th>
                    <th className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase text-app-fg-muted">
                      Price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="border-t border-app-line-15">
                      <td className="px-2 py-1.5 font-mono text-violet-300">{row.productId}</td>
                      <td className="px-2 py-1.5 text-app-fg">{row.productName}</td>
                      <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-app-fg">
                        {row.price}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleImport}
                disabled={uploading}
                className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
              >
                {uploading ? 'Importazione...' : 'Conferma Importazione'}
              </button>
              <button
                type="button"
                onClick={handleCancelPreview}
                disabled={uploading}
                className="rounded-lg border border-app-line-28 bg-app-line-10 px-4 py-2 text-sm font-medium text-app-fg-muted transition-colors hover:bg-app-line-15 disabled:opacity-50"
              >
                Annulla
              </button>
            </div>
          </div>
        )}

        {/* Summary */}
        {showSummary && summary && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="mb-3 flex items-center gap-2">
              <svg className="h-5 w-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-bold text-emerald-200">Importazione completata</p>
            </div>

            <div className="mb-3 grid grid-cols-3 gap-2">
              <div className="rounded-md bg-app-line-15/50 px-3 py-2 text-center">
                <p className="text-xs text-app-fg-muted">Aggiornati</p>
                <p className="text-xl font-bold tabular-nums text-app-fg">{summary.updated}</p>
              </div>
              <div className="rounded-md bg-app-line-15/50 px-3 py-2 text-center">
                <p className="text-xs text-app-fg-muted">Nuovi</p>
                <p className="text-xl font-bold tabular-nums text-app-fg">{summary.created}</p>
              </div>
              <div className="rounded-md bg-app-line-15/50 px-3 py-2 text-center">
                <p className="text-xs text-app-fg-muted">Anomalie</p>
                <p className="text-xl font-bold tabular-nums text-red-300">{summary.anomalies.length}</p>
              </div>
            </div>

            {summary.anomalies.length > 0 && (
              <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-red-200">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Rincari rilevati (oltre 5%)
                </p>
                <div className="max-h-40 space-y-1.5 overflow-y-auto">
                  {summary.anomalies.map((anomaly, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-red-500/20 bg-red-950/30 px-2 py-1.5 text-xs"
                    >
                      <p className="font-semibold text-red-200">{anomaly.prodotto}</p>
                      <p className="mt-0.5 text-red-300/90">
                        <span className="font-mono">{anomaly.rekki_product_id}</span> •{' '}
                        <span className="line-through">£{anomaly.old_price.toFixed(2)}</span> →{' '}
                        <span className="font-bold">£{anomaly.new_price.toFixed(2)}</span> •{' '}
                        <span className="font-bold text-red-200">+{anomaly.delta_pct.toFixed(1)}%</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary.errors.length > 0 && (
              <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="mb-2 text-xs font-bold text-amber-200">
                  Errori ({summary.errors.length})
                </p>
                <div className="max-h-32 space-y-1 overflow-y-auto text-xs text-amber-300/90">
                  {summary.errors.slice(0, 10).map((err, idx) => (
                    <p key={idx}>
                      {err.row > 0 ? `Riga ${err.row}: ` : ''}
                      {err.error}
                    </p>
                  ))}
                  {summary.errors.length > 10 && (
                    <p className="font-semibold">...e altri {summary.errors.length - 10} errori</p>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setShowSummary(false)
                setSummary(null)
              }}
              className="w-full rounded-lg border border-app-line-28 bg-app-line-10 px-4 py-2 text-sm font-medium text-app-fg transition-colors hover:bg-app-line-15"
            >
              Chiudi
            </button>
          </div>
        )}

        {/* Helper text */}
        {!showPreview && !showSummary && (
          <details className="mt-3 rounded-lg border border-app-line-22 bg-app-line-10/50 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-violet-300 hover:text-violet-200">
              Come ottenere il listino da Rekki?
            </summary>
            <div className="mt-2 space-y-2 text-xs leading-relaxed text-app-fg-muted">
              <p>1. Accedi al tuo account Rekki</p>
              <p>2. Vai alla pagina del fornitore <span className="font-semibold text-app-fg">{fornitoreNome}</span></p>
              <p>3. Esporta il listino prodotti in formato CSV o Excel</p>
              <p>4. Assicurati che il file contenga le colonne: <span className="font-mono text-violet-300">Product ID</span>, <span className="font-mono text-violet-300">Product Name</span>, <span className="font-mono text-violet-300">Price</span></p>
            </div>
          </details>
        )}
      </div>
    </div>
  )
}
