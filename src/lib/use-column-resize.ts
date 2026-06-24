'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type ColumnWidths = Record<string, number>

/**
 * Hook per rendere le colonne di una tabella ridimensionabili tramite drag.
 *
 * @param columnIds - Array di identificatori unici per ogni colonna (nell'ordine delle <col>).
 * @param defaultWidths - Larghezze iniziali in px (opzionale).
 * @returns `colWidths` (Record<id, px>) e `tableRef` da attaccare al `<table>`.
 *
 * Uso:
 * ```tsx
 * const { colWidths, tableRef, onThMouseDown } = useColumnResize(['col1', 'col2', 'col3'])
 *
 * <table ref={tableRef}>
 *   <colgroup>
 *     <col style={{ width: colWidths.col1 }} />
 *     <col style={{ width: colWidths.col2 }} />
 *     <col style={{ width: colWidths.col3 }} />
 *   </colgroup>
 *   <thead>
 *     <tr>
 *       <th onMouseDown={(e) => onThMouseDown('col1', e)}>Colonna 1</th>
 *       ...
 * ```
 */
export function useColumnResize(
  columnIds: string[],
  defaultWidths?: Partial<Record<string, number>>,
) {
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const id of columnIds) {
      initial[id] = defaultWidths?.[id] ?? 0
    }
    return initial
  })

  const dragging = useRef<{
    colId: string
    startX: number
    startWidth: number
  } | null>(null)

  const tableRef = useRef<HTMLTableElement | null>(null)

  const onThMouseDown = useCallback(
    (colId: string, e: React.MouseEvent<HTMLElement>) => {
      e.preventDefault()
      const th = e.currentTarget
      const rect = th.getBoundingClientRect()
      const handleWidth = 6
      const isOnEdge = e.clientX >= rect.right - handleWidth && e.clientX <= rect.right + 2

      if (!isOnEdge) return

      dragging.current = {
        colId,
        startX: e.clientX,
        startWidth: colWidths[colId] || rect.width,
      }

      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [colWidths],
  )

  useEffect(() => {
    if (!dragging.current) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const { colId, startX, startWidth } = dragging.current
      const diff = e.clientX - startX
      const newWidth = Math.max(40, startWidth + diff)

      setColWidths((prev) => ({ ...prev, [colId]: newWidth }))
    }

    const handleMouseUp = () => {
      dragging.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  /** Crea un handler `onMouseDown` per un `th` con indicatore di resize sul bordo destro. */
  const getThProps = (colId: string) => ({
    onMouseDown: (e: React.MouseEvent<HTMLTableHeaderCellElement>) =>
      onThMouseDown(colId, e),
    style: {
      position: 'relative' as const,
      cursor: 'default',
    } as React.CSSProperties,
    'data-resize-col': colId,
  })

  return { colWidths, tableRef, getThProps }
}
