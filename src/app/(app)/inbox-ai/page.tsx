import Link from 'next/link'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import { getCookieStore, getT } from '@/lib/locale-server'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import DashboardFiscalYearHeaderForSede from '@/components/DashboardFiscalYearHeaderForSede'
import { APP_SHELL_SECTION_PAGE_H1_CLASS, APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'
import InboxAiClient from './inbox-ai-client'
import { BackButton } from '@/components/BackButton'

export const dynamic = 'force-dynamic'

export default async function InboxAiPage(props: { searchParams?: Promise<{ fy?: string; tab?: string }> }) {
  const searchParams = props.searchParams != null ? await props.searchParams : {}
  const [cookieStore, profile, { supabase }, t] = await Promise.all([
    getCookieStore(),
    getProfile(),
    getRequestAuth(),
    getT(),
  ])

  const isMasterAdmin = profile?.role === 'admin'
  const adminPick = isMasterAdmin ? cookieStore.get('admin-sede-id')?.value?.trim() || null : null
  let adminViewSedeId: string | null = null
  if (isMasterAdmin && adminPick) {
    const { data } = await supabase.from('sedi').select('id').eq('id', adminPick).maybeSingle()
    if (data?.id) adminViewSedeId = data.id
  }

  const sedeId = adminViewSedeId ?? profile?.sede_id ?? null
  const blockedNoSede = !isMasterAdmin && !profile?.sede_id

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <AppPageHeaderStrip
        accent="cyan"
        leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
      >
        <div className="min-w-0">
          <nav className="text-[13px]" aria-label="Percorso">
            <Link
              href="/revisione"
              className="text-app-fg-muted hover:text-teal-300 underline-offset-4 hover:underline focus:outline-none focus-visible:underline"
            >
              Inbox urgente
            </Link>
            <span className="mx-2 text-[rgba(226,232,240,0.35)] select-none">&rsaquo;</span>
            <span className="text-app-fg-muted">AI Inbox</span>
          </nav>
          <h1 className={`${APP_SHELL_SECTION_PAGE_H1_CLASS} mt-0.5`}>AI Inbox</h1>
          <p className="max-w-xl text-[13px] leading-relaxed text-app-fg-muted">
            Gestione guidata dall’AI per documenti in coda, duplicati fatture/bolle e anomalie Rekki — una sede alla volta (stesso
            ambito sicurezza delle altre viste operative).
          </p>
        </div>
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
