import Link from 'next/link'
import { createServiceClient } from '@/utils/supabase/server'
import { getProfile, getRequestAuth } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import ScanEmailButton from '@/components/ScanEmailButton'
import CountrySelector from '@/components/CountrySelector'
import { LocaleCodeChip } from '@/components/ui/locale-code-chip'
import SedeBranchManagementPanel from '@/components/SedeBranchManagementPanel'
import { getLocale } from '@/lib/localization'
import { getT } from '@/lib/locale-server'
import { BackButton } from '@/components/BackButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { isBranchSedeStaffRole } from '@/lib/roles'
import SedeFileRetentionSection from '@/components/SedeFileRetentionSection'

interface SedeProfile {
  id: string
  nome: string
  imap_user: string | null
  imap_host: string | null
  imap_port: number | null
  imap_lookback_days: number | null
  country_code: string
  fornitori_count: number
  operators_count: number
  file_retention_policy: string | null
  file_retention_run_day: number | null
  file_retention_days: number | null
}

type SedeOperatorRow = {
  id: string
  full_name: string | null
  role: string | null
}

async function fetchSedePageData(sedeId: string): Promise<{
  sede: SedeProfile | null
  operators: SedeOperatorRow[]
}> {
  const service = createServiceClient()

  const [sedeRes, fornCountRes, profilesRes] = await Promise.all([
    service
      .from('sedi')
      .select(
        'id, nome, imap_user, imap_host, imap_port, imap_lookback_days, country_code, file_retention_policy, file_retention_run_day, file_retention_days',
      )
      .eq('id', sedeId)
      .maybeSingle(),
    service.from('fornitori').select('*', { count: 'exact', head: true }).eq('sede_id', sedeId),
    service.from('profiles').select('id, full_name, role').eq('sede_id', sedeId).order('full_name', { ascending: true }),
  ])

  if (!sedeRes.data) return { sede: null, operators: [] }

  const row = sedeRes.data

  const operators = (profilesRes.data ?? []) as SedeOperatorRow[]

  return {
    sede: {
      id: row.id,
      nome: row.nome,
      imap_user: row.imap_user ?? null,
      imap_host: row.imap_host ?? null,
      imap_port: (row as { imap_port?: number | null }).imap_port ?? null,
      imap_lookback_days: (row as { imap_lookback_days?: number | null }).imap_lookback_days ?? null,
      country_code: (row as { country_code?: string }).country_code ?? 'UK',
      fornitori_count: fornCountRes.count ?? 0,
      operators_count: operators.length,
      file_retention_policy: (row as { file_retention_policy?: string | null }).file_retention_policy ?? null,
      file_retention_run_day: (row as { file_retention_run_day?: number | null }).file_retention_run_day ?? null,
      file_retention_days: (row as { file_retention_days?: number | null }).file_retention_days ?? null,
    },
    operators,
  }
}

export default async function SedeProfilePage(props: { params: Promise<{ sede_id: string }> }) {
  const { user } = await getRequestAuth()
  if (!user) redirect('/login')

  const { sede_id } = await props.params
  const { sede, operators } = await fetchSedePageData(sede_id)
  if (!sede) redirect('/sedi')

  const profile = await getProfile()
  const isMasterAdmin = profile?.role === 'admin'
  const isStaffThisSede = isBranchSedeStaffRole(profile?.role) && profile?.sede_id === sede_id
  const canManageSedeOperators = isMasterAdmin || isStaffThisSede

  const tDashboard = await getT()

  const imapConfigured = !!(sede.imap_host && sede.imap_user)

  return (
    <div className="w-full min-w-0 app-shell-page-padding">
      <AppPageHeaderStrip
        dense
        accent="teal"
        leadingAccessory={
          <BackButton
            href={isMasterAdmin ? '/sedi' : '/'}
            label={isMasterAdmin ? tDashboard.nav.sediNavGroupMaster : tDashboard.nav.dashboard}
            iconOnly
            className="mb-0 shrink-0"
          />
        }
        icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="app-page-title min-w-0 truncate text-lg font-bold leading-snug sm:text-xl md:text-2xl">{sede.nome}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <span className="text-sm text-app-fg-muted">
                  {sede.operators_count}{' '}
                  {sede.operators_count === 1 ? 'operatore' : 'operatori'}
                </span>
                <span className="text-app-fg-muted">·</span>
                <span className="text-sm text-app-fg-muted">
                  {sede.fornitori_count}{' '}
                  {sede.fornitori_count === 1 ? 'fornitore' : 'fornitori'}
                </span>
                <span className="text-app-fg-muted">·</span>
                {imapConfigured ? (
                  <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Email configurata ({sede.imap_user})
                  </span>
                ) : (
                  <span className="rounded-full border border-[rgba(34,211,238,0.15)] bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-200">
                    Email non configurata
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex min-w-0 w-full max-w-full flex-row flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end sm:gap-3 sm:shrink-0">
            <ScanEmailButton sedeId={sede_id} alwaysShowLabel placement="desktopHeader" />
          </div>
        </div>
      </AppPageHeaderStrip>

      {canManageSedeOperators ? (
        <SedeBranchManagementPanel
          sedeId={sede_id}
          operators={operators}
          imapInitial={{
            host: sede.imap_host ?? '',
            port: sede.imap_port ?? 993,
            user: sede.imap_user ?? '',
            lookbackDays: sede.imap_lookback_days,
          }}
        />
      ) : null}

      {/* Paese / Localizzazione */}
      {(() => {
        const loc = getLocale(sede.country_code)
        return (
          <div className="app-card mb-6 flex flex-col overflow-hidden">
            <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex shrink-0 items-center gap-2 text-sm text-app-fg-muted">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21l18-9-18-9v7l12 2-12 2v7z" />
              </svg>
              Paese sede
            </div>
            <CountrySelector sedeId={sede.id} initialCode={sede.country_code} />
            <div className="ml-auto flex flex-wrap items-center gap-4 text-xs text-app-fg-muted">
              <span><span className="font-medium text-app-fg-muted">{loc.vat}</span> · etichetta imposta</span>
              <span><span className="font-medium text-app-fg-muted">{loc.vatLabel}</span> · n. partita {loc.vat}</span>
              <span className="inline-flex flex-wrap items-center gap-1">
                <span className="font-medium text-app-fg-muted">{loc.currency}</span>
                <span>· valuta</span>
                <LocaleCodeChip code={sede.country_code} className="inline-flex h-5 min-w-[1.5rem] text-[9px]" />
              </span>
            </div>
            </div>
          </div>
        )
      })()}

      <SedeFileRetentionSection
        sedeId={sede_id}
        initialPolicy={sede.file_retention_policy}
        initialDays={sede.file_retention_days}
        initialRunDay={sede.file_retention_run_day}
        canEdit={canManageSedeOperators}
      />

      {/* IMAP not configured warning */}
      {!imapConfigured && (
        <div className="flex items-start gap-3 bg-amber-50 border border-[rgba(34,211,238,0.15)] rounded-xl p-4">
          <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-amber-800">Casella email non configurata</p>
            <p className="text-xs text-amber-700 mt-1">
              Per abilitare la scansione email per questa azienda, configura le impostazioni IMAP in{' '}
              <Link href="/sedi" className="underline">Gestione aziende</Link>.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
