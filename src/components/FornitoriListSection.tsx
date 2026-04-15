'use client'

import { useMemo, useState } from 'react'
import type { Fornitore } from '@/types'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'
import FornitoriCardsGrid from '@/components/FornitoriCardsGrid'
import { useT } from '@/lib/use-t'
import { fornitoreDisplayLabel } from '@/lib/fornitore-display'

function fornitoreMatchesQuery(f: Fornitore, q: string): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const hay = [
    fornitoreDisplayLabel(f),
    f.nome ?? '',
    f.display_name ?? '',
    f.email ?? '',
    f.piva ?? '',
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(s)
}

export default function FornitoriListSection({
  fornitori,
  sedeScope,
}: {
  fornitori: Fornitore[]
  sedeScope: string
}) {
  const t = useT()
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () => fornitori.filter((f) => fornitoreMatchesQuery(f, query)),
    [fornitori, query],
  )

  const trimmed = query.trim()
  const isSearchEmpty = filtered.length === 0 && trimmed.length > 0 && fornitori.length > 0

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 md:gap-6">
      <AppSummaryHighlightCard
        className="!mb-0"
        accent="sky"
        label={t.common.total}
        primary={fornitori.length}
        secondary={t.fornitori.countLabel}
        trailing={
          <label className="block min-w-0 w-full sm:w-72">
            <span className="sr-only">{t.nav.cerca}</span>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sky-400/70"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.nav.cerca}
                autoComplete="off"
                className="w-full rounded-md border border-sky-500/35 app-workspace-inset-bg-soft py-1.5 pl-8 pr-2.5 text-xs font-normal text-app-fg placeholder:text-app-fg-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-sky-500/10 [color-scheme:dark] focus:border-sky-400/55 focus:outline-none focus:ring-2 focus:ring-sky-400/30"
              />
            </div>
          </label>
        }
      />

      <FornitoriCardsGrid
        fornitori={filtered}
        cacheSourceFornitori={fornitori}
        sedeScope={sedeScope}
        emptyState={isSearchEmpty ? t.nav.nessunRisultato : t.fornitori.noSuppliers}
        addFirstLabel={t.fornitori.addFirst}
        showAddWhenEmpty={!isSearchEmpty}
      />
    </div>
  )
}
