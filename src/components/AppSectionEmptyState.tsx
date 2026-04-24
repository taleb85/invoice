import type { ReactNode } from 'react'

const defaultIcon = (
  <svg
    className="app-empty-state-icon mx-auto"
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
  subtitle,
  icon,
  children,
  density = 'default',
  messageClassName,
  showIcon = true,
}: {
  message: ReactNode
  /** Optional second line rendered dimmer below the main message. */
  subtitle?: ReactNode
  icon?: ReactNode
  children?: ReactNode
  /** `comfortable` = more vertical padding (ex. `py-16`). */
  density?: 'default' | 'comfortable'
  /** Applied to the message paragraph (e.g. loading tone). */
  messageClassName?: string
  showIcon?: boolean
}) {
  const py = density === 'comfortable' ? 'py-16' : 'py-14'
  return (
    <div className={`app-empty-state px-6 ${py}`}>
      {showIcon ? (icon ?? defaultIcon) : null}
      <p className={['app-empty-state-title', messageClassName ?? ''].join(' ').trim()}>{message}</p>
      {subtitle && <p className="app-empty-state-sub">{subtitle}</p>}
      {children}
    </div>
  )
}
