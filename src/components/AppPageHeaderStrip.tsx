import type { ReactNode } from 'react'

const innerCls =
  'flex w-full min-w-0 flex-col gap-3 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-3 md:px-5 md:py-4'

/**
 * Titolo pagina con stesso effetto di `.app-card` (vetro, ring cyan, ombre neon) + `app-card-bar`.
 */
export default function AppPageHeaderStrip({
  children,
  embedded,
  className,
}: {
  children: ReactNode
  embedded?: boolean
  className?: string
}) {
  const shell = embedded
    ? 'app-card flex flex-col overflow-hidden p-0'
    : 'app-card mb-6 flex flex-col overflow-hidden p-0 md:mb-8'
  const outer = className ? `${shell} ${className}` : shell
  return (
    <div className={outer}>
      <div className="app-card-bar shrink-0" aria-hidden />
      <div className={innerCls}>{children}</div>
    </div>
  )
}
