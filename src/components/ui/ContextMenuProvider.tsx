'use client'

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import ContextMenu, { type ContextMenuItem } from '@/components/ui/ContextMenu'

type ContextMenuState = {
  x: number
  y: number
  items: ContextMenuItem[]
}

type ContextMenuContextValue = {
  show: (params: { x: number; y: number; items: ContextMenuItem[] }) => void
  hide: () => void
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null)

export function useContextMenu() {
  const ctx = useContext(ContextMenuContext)
  if (!ctx) throw new Error('useContextMenu must be used within a ContextMenuProvider')
  return ctx
}

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const lastItemsRef = useRef<ContextMenuItem[]>([])

  const show = useCallback((params: { x: number; y: number; items: ContextMenuItem[] }) => {
    lastItemsRef.current = params.items
    setMenu({ x: params.x, y: params.y, items: params.items })
  }, [])

  const hide = useCallback(() => {
    setMenu(null)
    lastItemsRef.current = []
  }, [])

  return (
    <ContextMenuContext.Provider value={{ show, hide }}>
      {children}
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={hide}
        />
      )}
    </ContextMenuContext.Provider>
  )
}
