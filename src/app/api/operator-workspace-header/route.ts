import { NextRequest, NextResponse } from 'next/server'
import { getCookieStore } from '@/lib/locale-server'
import { parseFiscalYearQueryParam } from '@/lib/fiscal-year'
import {
  countFornitoriWithOverdueBolle,
  fetchOperatorDashboardKpis,
  fornitoreIdsForSede,
} from '@/lib/dashboard-operator-kpis'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import { resolveActiveSedeIdForLists } from '@/lib/resolve-active-sede-for-lists'
import type { OperatorWorkspaceHeaderPayload } from '@/types/operator-workspace-header'

/**
 * Conteggi per la strip desktop (quick nav + badge solleciti), allineati a `page.tsx` dashboard.
 */
export async function GET(req: NextRequest) {
  const { supabase, user } = await getRequestAuth()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [profile, cookieStore] = await Promise.all([getProfile(), getCookieStore()])
  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const sedeId = await resolveActiveSedeIdForLists(
    supabase,
    { role: profile.role, sede_id: profile.sede_id },
    (n) => cookieStore.get(n),
  )
  const operatorScoped = !!sedeId

  const fyRaw = req.nextUrl.searchParams.get('fy')?.trim() || undefined

  if (!operatorScoped) {
    const sollecitiFornitori = await countFornitoriWithOverdueBolle(supabase, null)
    const payload: OperatorWorkspaceHeaderPayload = {
      operatorScoped: false,
      fiscalYear: 0,
      sollecitiFornitori,
      counts: null,
    }
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, max-age=20, stale-while-revalidate=40' },
    })
  }

  const [fornitoreIds, sedeMetaRow] = await Promise.all([
    fornitoreIdsForSede(supabase, sedeId),
    supabase
      .from('sedi')
      .select('country_code, last_imap_sync_at, last_imap_sync_error')
      .eq('id', sedeId)
      .maybeSingle(),
  ])
  const sedeCountryCode = (sedeMetaRow.data?.country_code ?? 'IT').trim() || 'IT'
  const fiscalYear = parseFiscalYearQueryParam(fyRaw, sedeCountryCode)
  const kpiFiscal = { countryCode: sedeCountryCode, labelYear: fiscalYear }

  const [kpis, sollecitiFornitori] = await Promise.all([
    fetchOperatorDashboardKpis(supabase, sedeId, fornitoreIds, kpiFiscal),
    countFornitoriWithOverdueBolle(supabase, fornitoreIds),
  ])

  const syncRow = sedeMetaRow.data as {
    last_imap_sync_at?: string | null
    last_imap_sync_error?: string | null
  } | null

  const payload: OperatorWorkspaceHeaderPayload = {
    operatorScoped: true,
    fiscalYear,
    sollecitiFornitori,
    counts: {
      ordini: kpis.ordiniCount,
      bolle: kpis.bolleTotal,
      fatture: kpis.fattureCount,
      statements: kpis.statementsTotal,
      listino: kpis.listinoProdottiDistinti,
      documenti: kpis.documentiPending,
    },
    lastImapSyncAt: syncRow?.last_imap_sync_at ?? null,
    lastImapSyncError: syncRow?.last_imap_sync_error ?? null,
  }
  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'private, max-age=20, stale-while-revalidate=40' },
  })
}
