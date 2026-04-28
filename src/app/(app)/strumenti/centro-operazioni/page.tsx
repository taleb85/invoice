'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { useLocale } from '@/lib/locale-context'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsAdminSedeUi, effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import AppPageHeaderDesktopTray from '@/components/AppPageHeaderDesktopTray'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { BackButton } from '@/components/BackButton'
import FixOcrDatesCard from '@/components/admin/fix-ocr-dates-card'
import DuplicateManager from '@/components/duplicates/duplicate-manager'
import DashboardDuplicateFattureButton from '@/components/DashboardDuplicateFattureButton'
import { APP_SHELL_SECTION_PAGE_CLASS, APP_SHELL_SECTION_PAGE_H1_CLASS } from '@/lib/app-shell-layout'

type CardProps = {
  eyebrow: string
  title: string
  description: string
  icon: ReactNode
  accent: string
  children: ReactNode
}

function ToolCard({ eyebrow, title, description, icon, accent, children }: CardProps) {
  return (
    <div className="app-card overflow-hidden">
      <div className="flex items-start gap-4 app-workspace-inset-bg-soft p-5">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${accent}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{eyebrow}</p>
          <p className="mt-0.5 text-sm font-semibold text-app-fg">{title}</p>
          <p className="mt-1 text-xs leading-snug text-app-fg-muted">{description}</p>
          <div className="mt-3 flex flex-wrap gap-2">{children}</div>
        </div>
      </div>
    </div>
  )
}

const linkBtnCls =
  'inline-flex touch-manipulation items-center justify-center gap-2 rounded-lg border border-app-line-35 bg-black/25 px-3.5 py-2 text-xs font-semibold text-app-fg transition-colors hover:border-app-a-45 hover:bg-app-line-10'

export default function CentroOperazioniPage() {
  const { t } = useLocale()
  const s = t.strumentiCentroOperazioni
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const [dupOpen, setDupOpen] = useState(false)

  const masterPlane = effectiveIsMasterAdminPlane(me, activeOperator)
  const isAdminSede = effectiveIsAdminSedeUi(me, activeOperator)
  const canManageDuplicates = !!(me?.sede_id && (masterPlane || isAdminSede))

  return (
    <>
      <div className={`${APP_SHELL_SECTION_PAGE_CLASS} md:hidden`}>
        <BackButton href="/" label={t.nav.dashboard} />
        <AppPageHeaderStrip accent="cyan">
          <AppPageHeaderTitleWithDashboardShortcut>
            <nav className="text-[11px] text-app-fg-muted" aria-label="Breadcrumb">
              <Link
                href="/strumenti"
                className="text-app-fg-muted underline-offset-4 hover:text-cyan-200 hover:underline"
              >
                {s.breadcrumbTools}
              </Link>
              <span className="mx-2 text-app-fg-muted/40">&rsaquo;</span>
              <span>{s.pageTitle}</span>
            </nav>
            <h1 className={`mt-2 ${APP_SHELL_SECTION_PAGE_H1_CLASS}`}>{s.pageTitle}</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-app-fg-muted">{s.pageSubtitle}</p>
          </AppPageHeaderTitleWithDashboardShortcut>
        </AppPageHeaderStrip>

        <div className="mt-6 space-y-8 px-6 pb-10">
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-teal-200/95">{s.sectionOcr}</h2>
            <ToolCard
              eyebrow="AI Inbox · OCR"
              title={s.cardReanalyzeTitle}
              description={s.cardReanalyzeDesc}
              accent="bg-teal-500/12 ring-teal-400/25"
              icon={
                <svg className="h-5 w-5 text-teal-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            >
              <Link href="/inbox-ai" className={linkBtnCls}>
                {s.cardOpenInbox}
              </Link>
            </ToolCard>

            <FixOcrDatesCard />

            <ToolCard
              eyebrow={t.fatture.title}
              title={s.cardRefreshDateTitle}
              description={s.cardRefreshDateDesc}
              accent="bg-violet-500/12 ring-violet-400/25"
              icon={
                <svg className="h-5 w-5 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            >
              <Link href="/fatture" className={linkBtnCls}>
                {s.cardOpenFatture}
              </Link>
            </ToolCard>

            <ToolCard
              eyebrow={t.fornitori.title}
              title={s.cardOcrCheckTitle}
              description={s.cardOcrCheckDesc}
              accent="bg-amber-500/12 ring-amber-500/25"
              icon={
                <svg className="h-5 w-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              }
            >
              <Link href="/fornitori" className={linkBtnCls}>
                {s.cardOpenFornitoreSheet}
              </Link>
            </ToolCard>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-200/95">{s.sectionDup}</h2>

            <ToolCard
              eyebrow={t.nav.dashboard}
              title={s.cardDupScanTitle}
              description={s.cardDupScanDesc}
              accent="bg-amber-950/40 ring-app-line-35"
              icon={
                <svg className="h-5 w-5 text-amber-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-2" />
                </svg>
              }
            >
              <DashboardDuplicateFattureButton alwaysShowLabel />
            </ToolCard>

            {canManageDuplicates ? (
              <ToolCard
                eyebrow={s.cardDupManageTitle}
                title={s.cardDupManageTitle}
                description={s.cardDupManageDesc}
                accent="bg-amber-500/12 ring-amber-500/25"
                icon={
                  <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                }
              >
                <button
                  type="button"
                  onClick={() => setDupOpen(true)}
                  className={`${linkBtnCls} border-amber-500/35 bg-amber-500/10 text-amber-100 hover:bg-amber-500/18`}
                >
                  {s.cardDupManageCta}
                </button>
              </ToolCard>
            ) : null}

            <ToolCard
              eyebrow="AI Inbox"
              title={s.cardAuditTitle}
              description={s.cardAuditDesc}
              accent="bg-cyan-500/12 ring-cyan-400/25"
              icon={
                <svg className="h-5 w-5 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
            >
              <Link href="/inbox-ai?tab=audit" className={linkBtnCls}>
                {s.cardOpenAudit}
              </Link>
            </ToolCard>
          </section>

          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-fuchsia-200/95">{s.sectionListino}</h2>

            <ToolCard
              eyebrow="Listino"
              title={s.cardListinoAutoTitle}
              description={s.cardListinoAutoDesc}
              accent="bg-violet-500/12 ring-violet-400/30"
              icon={
                <svg className="h-5 w-5 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
            >
              <Link href="/fornitori" className={linkBtnCls}>
                {s.cardListinoCta}
              </Link>
            </ToolCard>

            <ToolCard
              eyebrow="Listino"
              title={s.cardListinoFromInvTitle}
              description={s.cardListinoFromInvDesc}
              accent="bg-violet-500/18 ring-violet-400/40"
              icon={
                <svg className="h-5 w-5 text-violet-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              }
            >
              <Link href="/fornitori" className={linkBtnCls}>
                {s.cardListinoCta}
              </Link>
            </ToolCard>

            <ToolCard
              eyebrow="Listino"
              title={s.cardListinoAddTitle}
              description={s.cardListinoAddDesc}
              accent="bg-cyan-600/18 ring-app-a-35"
              icon={
                <svg className="h-5 w-5 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
              }
            >
              <Link href="/fornitori" className={linkBtnCls}>
                {s.cardListinoCta}
              </Link>
            </ToolCard>
          </section>

          <p className="rounded-xl border border-app-line-25 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-app-fg-muted">
            {s.hintContextualShortcuts}
          </p>
        </div>
      </div>

      <div className="hidden min-h-0 w-full flex-1 flex-col md:flex">
        <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-8 lg:px-8">
          <BackButton href="/" label={t.nav.dashboard} />
          <div className="app-card overflow-hidden">
            <div className="border-b border-app-line-30 px-6 py-5 sm:px-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <nav className="text-[11px] text-app-fg-muted" aria-label="Breadcrumb">
                    <Link
                      href="/strumenti"
                      className="text-app-fg-muted underline-offset-4 hover:text-cyan-200 hover:underline"
                    >
                      {s.breadcrumbTools}
                    </Link>
                    <span className="mx-2 text-app-fg-muted/40">&rsaquo;</span>
                    <span>{s.pageTitle}</span>
                  </nav>
                  <h1 className={`app-page-title mt-2 text-xl font-bold`}>{s.pageTitle}</h1>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-app-fg-muted">{s.pageSubtitle}</p>
                </div>
                <AppPageHeaderDesktopTray className="pt-0.5" />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-8">
            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-teal-200/95">{s.sectionOcr}</h2>
              <ToolCard
                eyebrow="AI Inbox · OCR"
                title={s.cardReanalyzeTitle}
                description={s.cardReanalyzeDesc}
                accent="bg-teal-500/12 ring-teal-400/25"
                icon={
                  <svg className="h-5 w-5 text-teal-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                }
              >
                <Link href="/inbox-ai" className={linkBtnCls}>
                  {s.cardOpenInbox}
                </Link>
              </ToolCard>

              <FixOcrDatesCard />

              <ToolCard
                eyebrow={t.fatture.title}
                title={s.cardRefreshDateTitle}
                description={s.cardRefreshDateDesc}
                accent="bg-violet-500/12 ring-violet-400/25"
                icon={
                  <svg className="h-5 w-5 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
              >
                <Link href="/fatture" className={linkBtnCls}>
                  {s.cardOpenFatture}
                </Link>
              </ToolCard>

              <ToolCard
                eyebrow={t.fornitori.title}
                title={s.cardOcrCheckTitle}
                description={s.cardOcrCheckDesc}
                accent="bg-amber-500/12 ring-amber-500/25"
                icon={
                  <svg className="h-5 w-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                }
              >
                <Link href="/fornitori" className={linkBtnCls}>
                  {s.cardOpenFornitoreSheet}
                </Link>
              </ToolCard>
            </section>

            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-rose-200/95">{s.sectionDup}</h2>

              <ToolCard
                eyebrow={t.nav.dashboard}
                title={s.cardDupScanTitle}
                description={s.cardDupScanDesc}
                accent="bg-amber-950/40 ring-app-line-35"
                icon={
                  <svg className="h-5 w-5 text-amber-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-2" />
                  </svg>
                }
              >
                <DashboardDuplicateFattureButton alwaysShowLabel />
              </ToolCard>

              {canManageDuplicates ? (
                <ToolCard
                  eyebrow={s.cardDupManageTitle}
                  title={s.cardDupManageTitle}
                  description={s.cardDupManageDesc}
                  accent="bg-amber-500/12 ring-amber-500/25"
                  icon={
                    <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                  }
                >
                  <button
                    type="button"
                    onClick={() => setDupOpen(true)}
                    className={`${linkBtnCls} border-amber-500/35 bg-amber-500/10 text-amber-100 hover:bg-amber-500/18`}
                  >
                    {s.cardDupManageCta}
                  </button>
                </ToolCard>
              ) : null}

              <ToolCard
                eyebrow="AI Inbox"
                title={s.cardAuditTitle}
                description={s.cardAuditDesc}
                accent="bg-cyan-500/12 ring-cyan-400/25"
                icon={
                  <svg className="h-5 w-5 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                }
              >
                <Link href="/inbox-ai?tab=audit" className={linkBtnCls}>
                  {s.cardOpenAudit}
                </Link>
              </ToolCard>
            </section>

            <section className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-fuchsia-200/95">{s.sectionListino}</h2>

              <ToolCard
                eyebrow="Listino"
                title={s.cardListinoAutoTitle}
                description={s.cardListinoAutoDesc}
                accent="bg-violet-500/12 ring-violet-400/30"
                icon={
                  <svg className="h-5 w-5 text-violet-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                }
              >
                <Link href="/fornitori" className={linkBtnCls}>
                  {s.cardListinoCta}
                </Link>
              </ToolCard>

              <ToolCard
                eyebrow="Listino"
                title={s.cardListinoFromInvTitle}
                description={s.cardListinoFromInvDesc}
                accent="bg-violet-500/18 ring-violet-400/40"
                icon={
                  <svg className="h-5 w-5 text-violet-100" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                }
              >
                <Link href="/fornitori" className={linkBtnCls}>
                  {s.cardListinoCta}
                </Link>
              </ToolCard>

              <ToolCard
                eyebrow="Listino"
                title={s.cardListinoAddTitle}
                description={s.cardListinoAddDesc}
                accent="bg-cyan-600/18 ring-app-a-35"
                icon={
                  <svg className="h-5 w-5 text-cyan-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                }
              >
                <Link href="/fornitori" className={linkBtnCls}>
                  {s.cardListinoCta}
                </Link>
              </ToolCard>
            </section>

            <p className="rounded-xl border border-app-line-25 bg-white/[0.03] px-4 py-3 text-xs leading-relaxed text-app-fg-muted">
              {s.hintContextualShortcuts}
            </p>
          </div>
        </div>
      </div>

      {canManageDuplicates ? (
        <DuplicateManager open={dupOpen} onOpenChange={setDupOpen} />
      ) : null}
    </>
  )
}
