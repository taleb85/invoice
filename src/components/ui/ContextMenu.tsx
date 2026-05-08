'use client'

import { useEffect, useRef, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export type ContextMenuItem = {
  key: string
  label: string
  icon?: ReactNode
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}

type ContextMenuProps = {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [onClose],
  )

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, handleKeyDown])

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const overflowX = rect.right - window.innerWidth
      const overflowY = rect.bottom - window.innerHeight
      if (overflowX > 0) {
        menuRef.current.style.left = `${x - rect.width}px`
      }
      if (overflowY > 0) {
        menuRef.current.style.top = `${y - rect.height}px`
      }
    }
  }, [x, y])

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{ left: x, top: y }}
      data-fluxo-context-menu
      className="fixed z-[9999] min-w-[180px] overflow-hidden rounded-lg border border-app-line-30 app-workspace-surface-elevated py-1 shadow-xl"
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          disabled={item.disabled}
          onClick={() => {
            item.onClick()
            onClose()
          }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors ${
            item.danger
              ? 'text-red-400 hover:bg-red-950/40 hover:text-red-300'
              : 'text-app-fg hover:bg-app-line-15'
          } ${item.disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
        >
          {item.icon && <span className="w-4 shrink-0">{item.icon}</span>}
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </div>,
    document.body,
  )
}
