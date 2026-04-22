'use client'

/**
 * Shared PIN numpad — grid 3×4 (1-9, C, 0, ⌫).
 * Used in OperatorSwitchModal and the /accesso operator login.
 */

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['C', '0', '⌫'],
]

interface PinNumpadProps {
  onDigit: (d: string) => void
  onBackspace: () => void
  onClear: () => void
  disabled?: boolean
}

export function PinNumpad({ onDigit, onBackspace, onClear, disabled = false }: PinNumpadProps) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
      {KEYS.flat().map((key, i) => {
        const isDigit  = key >= '0' && key <= '9'
        const isDelete = key === '⌫'
        const isClear  = key === 'C'

        return (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (isDigit)  onDigit(key)
              if (isDelete) onBackspace()
              if (isClear)  onClear()
            }}
            className={[
              'min-h-[52px] rounded-2xl border text-xl font-bold shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all select-none touch-manipulation active:scale-95 sm:h-16 sm:text-lg disabled:opacity-40 disabled:cursor-not-allowed',
              isDigit
                ? 'border-app-line-35 app-workspace-surface-elevated text-app-fg ring-1 ring-app-line-10 hover:border-app-a-50 hover:brightness-110'
                : 'border-app-soft-border app-workspace-inset-bg-soft text-app-fg-muted ring-1 ring-app-line-5 hover:border-app-a-35 hover:bg-black/18',
            ].join(' ')}
          >
            {key}
          </button>
        )
      })}
    </div>
  )
}
