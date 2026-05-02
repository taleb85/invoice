import Link from 'next/link'
import { NewFornitoreLink } from '@/components/NewFornitoreLink'
import { createServiceClient, getRequestAuth } from '@/utils/supabase/server'
import { getCookieStore } from '@/lib/locale-server'
import { Fornitore } from '@/types'
import FornitoriListSection from '@/components/FornitoriListSection'
import { getT } from '@/lib/locale-server'
import { BackButton } from '@/components/BackButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { standardLinkButtonClassName } from '@/components/ui/StandardButton'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import { resolveActiveSedeIdForLists } from '@/lib/resolve-active-sede-for-lists'

async function getFornitori(): Promise<{
  fornitori: Fornitore[]
  sedeNome: string | null
  sedeScope: string
}> {
  const { supabase, user } = await getRequestAuth()
  const cookieStore = await getCookieStore()

  const { data: profile } = user
    ? await supabase.from('profiles').select('role, sede_id').eq('id', user.id).maybeSingle()
    : { data: null }

  const sedeId = await resolveActiveSedeIdForLists(supabase, profile, (n) => cookieStore.get(n))
  let sedeNome: string | null = null

  if (sedeId) {
    const { data: sede } = await createServiceClient().from('sedi').select('nome').eq('id', sedeId).maybeSingle()
    sedeNome = sede?.nome ?? null
  }

  let q = supabase.from('fornitori').select('*').order('nome')
  if (sedeId) q = q.eq('sede_id', sedeId) as typeof q

  const { data } = await q
  const sedeScope = sedeId ?? 'all'
  return { fornitori: (data as Fornitore[]) ?? [], sedeNome, sedeScope }
}

export default async function FornitoriPage() {
  const [{ fornitori, sedeNome, sedeScope }, t] = await Promise.all([getFornitori(), getT()])

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="sky"
        flushBottom
        mergedSummary={{ label: t.common.total, primary: fornitori.length, secondary: t.fornitori.countLabel }}
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
      >
        <AppPageHeaderTitleWithDashboardShortcut>
          <div className="flex w-full min-w-0 items-center justify-between gap-2 sm:gap-3">
            <h1 className={`min-w-0 flex-1 truncate pr-2 ${APP_PAGE_HEADER_STRIP_H1_CLASS}`}>{t.fornitori.title}</h1>
            {sedeNome ? (
              <span className="inline-flex max-w-[min(100%,11rem)] shrink-0 items-center gap-1 rounded-full border border-app-line-35 bg-app-line-15 px-2 py-0.5 text-[11px] font-medium text-app-fg-muted sm:max-w-[min(100%,14rem)]">
                <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span className="truncate" title={sedeNome}>{sedeNome}</span>
              </span>
            ) : null}
          </div>
        </AppPageHeaderTitleWithDashboardShortcut>
        <div className="hidden min-w-0 max-w-full flex-row flex-wrap items-center justify-end gap-2 sm:gap-3 md:flex md:shrink-0">
          <Link
            href="/fornitori/import"
            className={`hidden md:flex ${standardLinkButtonClassName('secondary', 'sm')}`}
          >
            <svg className="w-3.5 h-3.5 shrink-0 text-sky-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t.fornitori.importaDaFattura}
          </Link>
          <NewFornitoreLink href="/fornitori/new" className={`hidden md:flex ${standardLinkButtonClassName('primary', 'sm')}`}>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t.fornitori.new}
          </NewFornitoreLink>
        </div>
      </AppPageHeaderStrip>

      <FornitoriListSection fornitori={fornitori} sedeScope={sedeScope} />
    </div>
  )
}
