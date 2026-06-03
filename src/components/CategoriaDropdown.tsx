'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const CATEGORIE_DISPONIBILI = [
  'FATTURA',
  'BOLLA',
  'ESTRATTO CONTO',
  'ORDINE',
  'LISTINO',
  'COMUNICAZIONE',
  'NOTA CREDITO',
] as const

type Props = {
  categoria: string
  documentoId: string
  onCategoriaChange: (nuovaCategoria: string) => void
}

export function CategoriaDropdown({ categoria, documentoId, onCategoriaChange }: Props) {
  const [categoriaDropdownOpen, setCategoriaDropdownOpen] = useState(false)
  const [categoriaUpdating, setCategoriaUpdating] = useState(false)
  const [categoriaSelezionata, setCategoriaSelezionata] = useState<string | null>(null)
  const [categoriaMenuStyle, setCategoriaMenuStyle] = useState<React.CSSProperties | undefined>(undefined)
  const [portalReady, setPortalReady] = useState(false)
  const categoriaBtnRef = useRef<HTMLButtonElement>(null)
  const categoriaMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!categoriaDropdownOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (
        categoriaBtnRef.current &&
        !categoriaBtnRef.current.contains(e.target as Node) &&
        categoriaMenuRef.current &&
        !categoriaMenuRef.current.contains(e.target as Node)
      ) {
        setCategoriaDropdownOpen(false)
        setCategoriaSelezionata(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [categoriaDropdownOpen])

  useEffect(() => {
    if (!categoriaDropdownOpen) return
    setCategoriaSelezionata(categoria ?? null)
    const btn = categoriaBtnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setCategoriaMenuStyle({
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      minWidth: `${Math.max(150, rect.width)}px`,
      zIndex: 9999,
    })
  }, [categoriaDropdownOpen, categoria])

  async function handleCategoriaChange(nuovaCategoria: string) {
    if (!onCategoriaChange || !documentoId) return
    setCategoriaDropdownOpen(false)
    setCategoriaUpdating(true)
    try {
      const res = await fetch('/api/documenti-associati/categoria', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documento_id: documentoId, categoria: nuovaCategoria }),
      })
      if (res.ok) {
        await res.json()
        onCategoriaChange(nuovaCategoria)
      }
    } catch {
      // silenzioso
    } finally {
      setCategoriaUpdating(false)
    }
  }

  return (
    <div className="relative">
      <button
        ref={categoriaBtnRef}
        type="button"
        onClick={() => setCategoriaDropdownOpen(!categoriaDropdownOpen)}
        className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-[10px] font-bold text-app-fg-muted transition-colors hover:bg-white/[0.08]"
        disabled={categoriaUpdating}
      >
        {categoriaUpdating ? '…' : categoria}
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {categoriaDropdownOpen && categoriaMenuStyle && portalReady && createPortal(
        <div
          ref={categoriaMenuRef}
          style={categoriaMenuStyle}
          className="rounded-md border border-white/20 bg-gray-900 shadow-2xl backdrop-blur-2xl py-1"
        >
          {CATEGORIE_DISPONIBILI.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoriaSelezionata(cat)}
              className={`block w-full px-3 py-1.5 text-left text-[11px] font-medium transition-colors hover:bg-white/10 ${
                cat === categoriaSelezionata ? 'text-cyan-300' : 'text-white/80'
              }`}
            >
              {cat === categoriaSelezionata && <span className="mr-1">●</span>}
              {cat}
            </button>
          ))}
          <div className="border-t border-white/10 mt-1 pt-1 px-2 pb-1">
            <button
              type="button"
              onClick={() => {
                if (categoriaSelezionata) handleCategoriaChange(categoriaSelezionata)
              }}
              disabled={!categoriaSelezionata}
              className="w-full rounded px-2 py-1.5 text-[11px] font-semibold text-white transition-colors bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Conferma
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
