'use client'

import Link from 'next/link'

export type InboxHubNavItem = {
  key: string
  label: string
  count: number
  /** Link esterno; se assente usa navigazione in-app. */
  href?: string
  /** Tab in-app (`/inbox-ai`). */
  inboxTab?: 'docs' | 'duplicati' | 'audit'
  inboxDup?: 'fatture' | 'bolle' | 'ordini'
  /** Mostra anche con conteggio 0 (es. centro controllo). */
  always?: boolean
}

type Props = {
  intro: string
  items: InboxHubNavItem[]
  advancedLabel: string
  advancedHint: string
  advancedHref: string
  emptyMessage: string
  onInAppNavigate: (tab: 'docs' | 'duplicati' | 'audit', dup?: 'fatture' | 'bolle' | 'ordini') => void
}

export function InboxOperationalHub({
  intro,
  items,
  advancedLabel,
  advancedHint,
  advancedHref,
  emptyMessage,
  onInAppNavigate,
}: Props) {
  const visible = items.filter((i) => i.always || i.count > 0)
  const actionable = visible.filter((i) => i.always || i.count > 0)

  return (
    <section className="space-y-4" aria-labelledby="inbox-hub-title">
      <div>
        <h2 id="inbox-hub-title" className="sr-only">
          {intro}
        </h2>
        <p className="text-sm leading-relaxed text-app-fg-muted">{intro}</p>
      </div>

      {actionable.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/15 px-4 py-6 text-center text-sm text-emerald-100/95">
          {emptyMessage}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => {
            const inner = (
              <>
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {item.count > 0 ? (
                    <span
                      className="shrink-0 tabular-nums text-base font-bold leading-none text-app-fg sm:text-lg"
                      title={String(item.count)}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </span>
              </>
            )
            const className =
              'block w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-semibold text-app-fg transition-colors hover:border-[rgba(34,211,238,0.15)] hover:bg-rose-950/20'

            if (item.href) {
              return (
                <li key={item.key}>
                  <Link href={item.href} className={className}>
                    {inner}
                  </Link>
                </li>
              )
            }
            if (item.inboxTab) {
              return (
                <li key={item.key}>
                  <button
                    type="button"
                    className={className}
                    onClick={() => onInAppNavigate(item.inboxTab!, item.inboxDup)}
                  >
                    {inner}
                  </button>
                </li>
              )
            }
            return null
          })}
        </ul>
      )}

      <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
        <Link
          href={advancedHref}
          className="text-sm font-semibold text-cyan-400/95 hover:text-cyan-300 hover:underline"
        >
          {advancedLabel} →
        </Link>
        <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">{advancedHint}</p>
      </div>
    </section>
  )
}
