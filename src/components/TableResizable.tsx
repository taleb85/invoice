'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import './TableResizeHandle.css'

type TableResizableProps = {
  children: ReactNode
  className?: string
}

/**
 * Wrapper globale per tabelle: abilita il drag-to-resize su qualsiasi `<th>`.
 * Avvolge la tabella: `<TableResizable><table>...</table></TableResizable>`.
 * Clicca e trascina sul lato destro di un th per ridimensionare la colonna.
 */
export default function TableResizable({ children, className }: TableResizableProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let dragEl: HTMLElement | null = null
    let colIdx = -1
    let startX = 0
    let startW = 0

    const onStart = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const th = target.closest<HTMLTableCellElement>('th')
      if (!th) return

      e.preventDefault()

      colIdx = Array.from(th.parentElement!.children).indexOf(th)
      dragEl = th
      startX = e.clientX
      startW = th.getBoundingClientRect().width

      th.classList.add('resizing')
      document.body.classList.add('table-col-resizing')
    }

    const setColWidth = (w: number) => {
      if (!dragEl) return
      const table = dragEl.closest('table')
      if (!table) return

      // Imposta larghezza sul th
      dragEl.style.width = w + 'px'
      dragEl.style.minWidth = w + 'px'
      dragEl.style.maxWidth = w + 'px'

      // Imposta larghezza sulle td dello stesso indice
      for (const tr of table.querySelectorAll('tbody tr')) {
        const cell = tr.children[colIdx] as HTMLElement | undefined
        if (cell) {
          cell.style.width = w + 'px'
          cell.style.minWidth = w + 'px'
          cell.style.maxWidth = w + 'px'
        }
      }

      // Imposta larghezza anche sul <col> corrispondente
      const colgroup = table.querySelector('colgroup')
      if (colgroup) {
        const col = colgroup.children[colIdx] as HTMLElement | undefined
        if (col) {
          col.style.width = w + 'px'
        }
      }

      // Ricalcola la larghezza totale della tabella come somma di tutte le colonne
      let totalW = 0
      const firstRow = table.querySelector('thead tr') ?? table.querySelector('tbody tr')
      if (firstRow) {
        for (let i = 0; i < firstRow.children.length; i++) {
          const cell = firstRow.children[i] as HTMLElement
          const cw = i === colIdx ? w : cell.getBoundingClientRect().width
          totalW += cw
          if (i !== colIdx) {
            cell.style.minWidth = cw + 'px'
            cell.style.maxWidth = cw + 'px'
          }
        }
      }
      const minTotal = parseInt(table.dataset.minWidth || '0')
      table.style.width = Math.max(totalW, minTotal) + 'px'
    }

    const onMove = (e: MouseEvent) => {
      if (!dragEl) return
      const w = Math.max(40, startW + (e.clientX - startX))
      setColWidth(w)
    }

    const onEnd = () => {
      if (dragEl) dragEl.classList.remove('resizing')
      dragEl = null
      colIdx = -1
      document.body.classList.remove('table-col-resizing')
    }

    container.addEventListener('mousedown', onStart)
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onEnd)

    return () => {
      container.removeEventListener('mousedown', onStart)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onEnd)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`table-resizable-wrapper ${className ?? ''}`.trim()}
    >
      {children}
    </div>
  )
}
