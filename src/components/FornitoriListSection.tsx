'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import type { Fornitore } from '@/types'
import AppSectionFiltersBar from '@/components/AppSectionFiltersBar'
import AppSummaryHighlightCard from '@/components/AppSummaryHighlightCard'
import FornitoriCardsGrid from '@/components/FornitoriCardsGrid'
import { StandardCard } from '@/components/ui/StandardCard'
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
  const [filterNoEmail, setFilterNoEmail] = useState(false)

  const noEmailCount = useMemo(() => fornitori.filter((f) => !f.email).length, [fornitori])

  const filtered = useMemo(
    () =>
      fornitori.filter(
        (f) =>
          fornitoreMatchesQuery(f, query) &&
          (!filterNoEmail || !f.email),
      ),
    [fornitori, query, filterNoEmail],
  )

  const trimmed = query.trim()
  const isSearchEmpty = filtered.length === 0 && (trimmed.length > 0 || filterNoEmail) && fornitori.length > 0

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 md:gap-6">
      <AppSectionFiltersBar aria-label={t.nav.cerca}>
        <label className="block min-w-0 flex-1 sm:max-w-md">
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
              className="w-full rounded-md border border-[rgba(34,211,238,0.15)] app-workspace-inset-bg-soft py-1.5 pl-8 pr-2.5 text-xs font-normal text-app-fg placeholder:text-app-fg-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-sky-500/10 [color-scheme:dark] focus:border-[rgba(34,211,238,0.15)] focus:outline-none focus:ring-2 focus:ring-sky-400/30"
            />
          </div>
        </label>

        {noEmailCount > 0 && (
          <button
            type="button"
            onClick={() => setFilterNoEmail((v) => !v)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              filterNoEmail
                ? 'border-[rgba(34,211,238,0.15)] bg-amber-500/20 text-amber-200'
                : 'border-[rgba(34,211,238,0.15)] bg-amber-950/30 text-amber-400/80 hover:bg-amber-500/15 hover:text-amber-300'
            }`}
            aria-pressed={filterNoEmail}
          >
            <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {t.appStrings.filterNoEmail}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${filterNoEmail ? 'bg-amber-400/25 text-amber-100' : 'bg-amber-900/50 text-amber-400'}`}>
              {noEmailCount}
            </span>
          </button>
        )}

        {/* Nuovo Fornitore: visible on mobile (header CTAs are md:hidden on sm and below) */}
        <Link
          href="/fornitori/new"
          className="app-glow-cyan md:hidden inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-app-cyan-500 px-3 text-xs font-bold text-cyan-950 transition-colors hover:bg-app-cyan-400 active:bg-cyan-600 touch-manipulation"
          aria-label={t.fornitori.new}
        >
          <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t.fornitori.new}
        </Link>
      </AppSectionFiltersBar>

      <StandardCard accent="sky" className="!mb-0">
        <FornitoriCardsGrid
          fornitori={filtered}
          cacheSourceFornitori={fornitori}
          sedeScope={sedeScope}
          emptyState={isSearchEmpty ? t.nav.nessunRisultato : t.fornitori.noSuppliers}
          addFirstLabel={t.fornitori.addFirst}
          showAddWhenEmpty={!isSearchEmpty}
        />
      </StandardCard>
    </div>
  )
}
