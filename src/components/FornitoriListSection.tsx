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
    <>
      <AppSummaryHighlightCard
        accent="indigo"
        label={t.common.total}
        primary={fornitori.length}
        secondary={t.fornitori.countLabel}
        footer={
          <label className="block min-w-0">
            <span className="sr-only">{t.nav.cerca}</span>
            <div className="relative">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
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
                className="w-full rounded-lg border border-slate-600/60 bg-slate-800/90 py-2.5 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/25"
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
    </>
  )
}
