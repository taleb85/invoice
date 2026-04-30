'use client'

import { useState } from 'react'
import { useLocale } from '@/lib/locale-context'
import { getGuidaContent } from '@/lib/guida-content'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_SHELL_SECTION_PAGE_SUBTITLE_CLASS,
} from '@/lib/app-shell-layout'
import { BackButton } from '@/components/BackButton'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; dot: string; chip: string }> = {
  blue:   { bg: 'bg-blue-500/10',   text: 'text-blue-200',   border: 'border-[rgba(34,211,238,0.15)]',   dot: 'bg-blue-500',   chip: 'bg-blue-500/20 text-blue-200' },
  cyan:   { bg: 'bg-app-line-10',   text: 'text-app-fg-muted',   border: 'border-app-line-30',   dot: 'bg-app-cyan-500',   chip: 'bg-app-line-20 text-app-fg-muted' },
  green:  { bg: 'bg-emerald-500/10',  text: 'text-emerald-200',  border: 'border-[rgba(34,211,238,0.15)]',  dot: 'bg-emerald-500',  chip: 'bg-emerald-500/20 text-emerald-200' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-200', border: 'border-[rgba(34,211,238,0.15)]', dot: 'bg-purple-500', chip: 'bg-purple-500/20 text-purple-200' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-200', border: 'border-[rgba(34,211,238,0.15)]', dot: 'bg-orange-500', chip: 'bg-orange-500/20 text-orange-200' },
  amber:  { bg: 'bg-amber-500/10',  text: 'text-amber-200',  border: 'border-[rgba(34,211,238,0.15)]',  dot: 'bg-amber-500',  chip: 'bg-amber-500/20 text-amber-200' },
  slate:  { bg: 'app-workspace-inset-bg-soft',  text: 'text-app-fg',  border: 'border-app-line-25',  dot: 'bg-white/40',  chip: 'app-workspace-inset-bg text-app-fg-muted' },
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  fornitori: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  bolle: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  fatture: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  statements: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  documenti: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  impostazioni: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
}

export default function GuidaPage() {
  const { locale, t } = useLocale()
  const content = getGuidaContent(locale)
  const [active, setActive] = useState<string>(content.sections[0].id)

  const current = content.sections.find(s => s.id === active) ?? content.sections[0]
  const c = COLOR_MAP[current.color]

  return (
    <div className="app-shell-page-padding max-w-6xl">
      <AppPageHeaderStrip
        accent="slate"
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>}
      >
        <AppPageHeaderTitleWithDashboardShortcut>
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{content.pageTitle}</h1>
          <p className={APP_SHELL_SECTION_PAGE_SUBTITLE_CLASS}>{content.pageSubtitle}</p>
        </AppPageHeaderTitleWithDashboardShortcut>
      </AppPageHeaderStrip>

      <div className="flex flex-col md:flex-row gap-6">

        {/* Left nav */}
        <aside className="md:w-52 shrink-0">
          <nav className="space-y-0.5">
            {content.sections.map(s => {
              const sc = COLOR_MAP[s.color]
              const isActive = s.id === active
              return (
                <button
                  key={s.id}
                  onClick={() => setActive(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all ${
                    isActive
                      ? `${sc.bg} ${sc.text} border ${sc.border}`
                      : 'text-app-fg-muted hover:bg-black/12 hover:text-app-fg'
                  }`}
                >
                  <span className={isActive ? sc.text : 'text-app-fg-muted'}>
                    {SECTION_ICONS[s.id]}
                  </span>
                  {s.title}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Right content */}
        <div className="flex-1 min-w-0">
          {/* Section header */}
          <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${c.bg} ${c.border} mb-4`}>
            <span className={c.text}>{SECTION_ICONS[current.id]}</span>
            <h2 className={`text-base font-bold ${c.text}`}>{current.title}</h2>
            <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${c.chip}`}>
              {current.items.length} {content.fnLabel}
            </span>
          </div>

          {/* Items */}
          <div className="space-y-3">
            {current.items.map((item, i) => (
              <div key={i} className="app-card overflow-hidden">
                <div className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${c.dot}`}>
                      <span className="text-[10px] font-bold text-white">{i + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-sm font-semibold text-app-fg">{item.title}</p>
                      <p className="text-sm leading-relaxed text-app-fg-muted">{item.desc}</p>
                      {item.tip && (
                        <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-[rgba(34,211,238,0.15)] bg-amber-500/10 px-3 py-2">
                          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          <p className="text-xs leading-relaxed text-amber-200">
                            <span className="font-semibold">{content.tipLabel}</span> {item.tip}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
