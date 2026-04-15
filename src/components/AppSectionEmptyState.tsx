import type { ReactNode } from 'react'

const defaultIcon = (
  <svg
    className="mx-auto mb-3 h-12 w-12 text-app-fg-muted"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    aria-hidden
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
)

export default function AppSectionEmptyState({
  message,
  icon,
  children,
  density = 'default',
  messageClassName,
  showIcon = true,
}: {
  message: ReactNode
  icon?: ReactNode
  children?: ReactNode
  /** `comfortable` = più padding verticale (ex. `py-16`). */
  density?: 'default' | 'comfortable'
  /** Aggiunto al paragrafo del messaggio (es. tono loading). */
  messageClassName?: string
  showIcon?: boolean
}) {
  const py = density === 'comfortable' ? 'py-16' : 'py-14'
  return (
    <div className={`px-6 ${py} text-center`}>
      {showIcon ? (icon ?? defaultIcon) : null}
      <p className={['text-sm font-medium', messageClassName ?? 'text-app-fg-muted'].join(' ')}>{message}</p>
      {children}
    </div>
  )
}
