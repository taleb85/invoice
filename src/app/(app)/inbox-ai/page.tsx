import Link from 'next/link'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import { getCookieStore, getT } from '@/lib/locale-server'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'
import InboxAiClient from './inbox-ai-client'
import { BackButton } from '@/components/BackButton'
import { unwrapSearchParams } from '@/lib/unwrap-next-search-params'
import { resolveActiveSedeIdForLists } from '@/lib/resolve-active-sede-for-lists'
import { isMasterAdminRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

export default async function InboxAiPage(props: { searchParams?: Promise<{ fy?: string; tab?: string }> }) {
  const searchParams = await unwrapSearchParams(props.searchParams)
  const [cookieStore, profile, { supabase }, t] = await Promise.all([
    getCookieStore(),
    getProfile(),
    getRequestAuth(),
    getT(),
  ])

  const isMasterAdmin = isMasterAdminRole(profile?.role)
  const sedeId = await resolveActiveSedeIdForLists(
    supabase,
    profile ? { role: profile.role, sede_id: profile.sede_id } : undefined,
    (n) => cookieStore.get(n),
  )
  const blockedNoSede = !isMasterAdmin && !sedeId

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="cyan"
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
      >
        <AppPageHeaderTitleWithDashboardShortcut>
          <nav className="text-[10px] leading-tight text-app-fg-muted" aria-label="Percorso">
            <Link
              href="/revisione"
              className="text-app-fg-muted hover:text-teal-300 underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
            >
              Inbox urgente
            </Link>
            <span className="mx-2 text-[rgba(226,232,240,0.35)] select-none">&rsaquo;</span>
            <span className="text-app-fg-muted">AI Inbox</span>
          </nav>
          <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>AI Inbox</h1>
          <p className={`${APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS} max-w-xl`}>
            Gestione guidata dall’AI per documenti in coda, duplicati fatture/bolle e anomalie Rekki — una sede alla volta (stesso
            ambito sicurezza delle altre viste operative).
          </p>
        </AppPageHeaderTitleWithDashboardShortcut>
        <div className="flex min-h-14 min-w-0 shrink-0 flex-col justify-end gap-3 sm:flex-row sm:items-end sm:justify-end">
          <DashboardFiscalYearHeaderForSede fyRaw={searchParams.fy} />
        </div>
      </AppPageHeaderStrip>

      <InboxAiClient
        sedeId={sedeId}
        blockedNoSede={Boolean(blockedNoSede)}
        initialTab={searchParams.tab ?? null}
      />
    </div>
  )
}
