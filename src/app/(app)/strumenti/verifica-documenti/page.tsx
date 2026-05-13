'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { useLocale } from '@/lib/locale-context'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { canAccessCentroOperazioniPage } from '@/lib/effective-operator-ui'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { BackButton } from '@/components/BackButton'
import {
  APP_PAGE_HEADER_STRIP_H1_CLASS,
  APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS,
  APP_SHELL_SECTION_PAGE_STACK_CLASS,
} from '@/lib/app-shell-layout'

const STATO_CONFIG: Record<string, { label: string; color: string; desc: string }> = {
  da_processare: { label: 'Da processare', color: 'text-amber-300', desc: 'In attesa di elaborazione iniziale' },
  da_associare: { label: 'Da associare', color: 'text-orange-300', desc: 'Pronto per associazione a fornitore' },
  bozza_creata: { label: 'Bozza creata', color: 'text-cyan-300', desc: 'Bozza documento creata, da finalizzare' },
  associato: { label: 'Associato', color: 'text-emerald-300', desc: 'Completato correttamente' },
  scartato: { label: 'Scartato', color: 'text-gray-400', desc: 'Documento scartato manualmente' },
  da_revisionare: { label: 'Da revisionare', color: 'text-rose-300', desc: 'Richiede revisione manuale' },
}

type AuditData = {
  riepilogo: {
    totale: number
    per_stato: { stato: string; count: number }[]
  }
  documenti_bloccati: {
    id: string
    stato: string
    created_at: string | null
    giorni_in_stato: number
    mittente: string | null
    file_name: string | null
    file_url: string | null
    pending_kind: string | null
  }[]
  documenti_da_revisionare: {
    id: string
    stato: string
    created_at: string | null
    giorni_in_stato: number
    mittente: string | null
    file_name: string | null
    file_url: string | null
    pending_kind: string | null
  }[]
  statement_con_problemi: {
    id: string
    fornitore_id: string | null
    file_url: string | null
    missing_rows: number | null
    created_at: string | null
  }[]
  errori_sincronizzazione_recenti: {
    id: string
    data: string | null
    stato: string
    sede_id: string | null
    message?: string | null
  }[]
  statistiche: {
    tasso_completamento: number
    totale_bloccati: number
    totale_da_revisionare: number
    totale_statement_issues: number
    totale_errori_sincro: number
  }
}

function StatCard({ label, value, color, note }: { label: string; value: string | number; color: string; note?: string }) {
  return (
    <div className="app-card overflow-hidden p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
      {note ? <p className="mt-0.5 text-xs text-app-fg-muted">{note}</p> : null}
    </div>
  )
}

function CollapsibleSection({
  title,
  count,
  countColor,
  defaultOpen,
  children,
}: {
  title: string
  count: number
  countColor: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  return (
    <div className="app-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-white/[0.03]"
      >
        <div className="flex items-center gap-3">
          <span className={`text-sm font-semibold ${countColor}`}>{title}</span>
          <span className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold ${countColor} bg-white/[0.06]`}>
            {count}
          </span>
        </div>
        <span className={`text-app-fg-muted transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open ? <div className="border-t border-app-line-10 p-4">{children}</div> : null}
    </div>
  )
}

function StatoBadge({ stato }: { stato: string }) {
  const cfg = STATO_CONFIG[stato] ?? { label: stato, color: 'text-gray-400', desc: '' }
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${cfg.color} bg-white/[0.06]`}>
      {cfg.label}
    </span>
  )
}

export default function VerificaDocumentiPage() {
  const { t } = useLocale()
  const { me, loading: meLoading } = useMe()
  const { activeOperator } = useActiveOperator()
  const canView = canAccessCentroOperazioniPage(me, activeOperator)

  const [data, setData] = useState<AuditData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/document-processing-audit', { cache: 'no-store' })
      const j = (await res.json().catch(() => ({}))) as AuditData & { error?: string }
      if (!res.ok) {
        setError(j.error ?? `HTTP ${res.status}`)
        return
      }
      setData(j)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore di rete')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canView) void load()
  }, [canView, load])

  if (meLoading) {
    return (
      <div className={`${APP_SHELL_SECTION_PAGE_STACK_CLASS} flex min-h-[40vh] items-center justify-center pb-10`}>
        <p className="text-sm text-app-fg-muted">{t.common.loading}</p>
      </div>
    )
  }

  if (!canView) {
    return (
      <div className={`${APP_SHELL_SECTION_PAGE_STACK_CLASS} pb-10`}>
        <div className="app-shell-page-padding mx-auto min-w-0 w-full max-w-[var(--app-layout-max-width)]">
          <AppPageHeaderStrip
            accent="teal"
            leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
          >
            <AppPageHeaderTitleWithDashboardShortcut>
              <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>Verifica documenti</h1>
              <p className={`${APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS} !max-w-none`}>Accesso riservato ad admin e operatori.</p>
            </AppPageHeaderTitleWithDashboardShortcut>
          </AppPageHeaderStrip>
          <div className="mt-6 app-card overflow-hidden p-6">
            <p className="m-0 text-sm leading-relaxed text-app-fg-muted">
              Non hai i permessi per visualizzare questa pagina.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const s = data?.statistiche
  const r = data?.riepilogo

  return (
    <div className={`${APP_SHELL_SECTION_PAGE_STACK_CLASS} pb-10`}>
      <div className="app-shell-page-padding mx-auto min-w-0 w-full max-w-[var(--app-layout-max-width)]">
        <AppPageHeaderStrip
          accent="teal"
          leadingAccessory={<BackButton href="/" label={t.nav.dashboard} iconOnly className="mb-0 shrink-0" />}
        >
          <AppPageHeaderTitleWithDashboardShortcut>
            <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>Verifica documenti</h1>
            <p className={`${APP_PAGE_HEADER_STRIP_SUBTITLE_CLASS} !max-w-none`}>
              Panoramica completa dello stato di elaborazione di tutti i documenti.
            </p>
          </AppPageHeaderTitleWithDashboardShortcut>
        </AppPageHeaderStrip>

        <div className="mt-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-app-fg-muted">{t.common.loading}</p>
            </div>
          ) : error ? (
            <div className="app-card overflow-hidden p-6">
              <p className="text-sm text-rose-300">{error}</p>
              <button
                type="button"
                onClick={load}
                className="mt-4 inline-flex items-center justify-center rounded-lg border border-cyan-500/45 bg-cyan-500/12 px-4 py-2 text-xs font-bold text-cyan-100 transition-colors hover:bg-cyan-500/18"
              >
                Riprova
              </button>
            </div>
          ) : data ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <StatCard label="Totale documenti" value={r?.totale ?? 0} color="text-white" />
                <StatCard
                  label="Completati"
                  value={`${s?.tasso_completamento ?? 0}%`}
                  color={s && s.tasso_completamento >= 80 ? 'text-emerald-300' : 'text-amber-300'}
                  note={`${r?.per_stato.find((x) => x.stato === 'associato')?.count ?? 0} associati + ${r?.per_stato.find((x) => x.stato === 'scartato')?.count ?? 0} scartati`}
                />
                <StatCard
                  label="Bloccati"
                  value={s?.totale_bloccati ?? 0}
                  color={s && s.totale_bloccati > 0 ? 'text-rose-300' : 'text-emerald-300'}
                  note="Stato non terminale da >7 giorni"
                />
                <StatCard
                  label="Da revisionare"
                  value={s?.totale_da_revisionare ?? 0}
                  color={s && s.totale_da_revisionare > 0 ? 'text-rose-300' : 'text-emerald-300'}
                />
                <StatCard
                  label="Statement con problemi"
                  value={s?.totale_statement_issues ?? 0}
                  color={s && s.totale_statement_issues > 0 ? 'text-amber-300' : 'text-emerald-300'}
                  note="missing_rows > 0"
                />
                <StatCard
                  label="Errori sincro (24h)"
                  value={s?.totale_errori_sincro ?? 0}
                  color={s && s.totale_errori_sincro > 0 ? 'text-rose-300' : 'text-emerald-300'}
                />
              </div>

              <div className="app-card overflow-hidden">
                <div className="border-b border-app-line-10 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">
                    Stato elaborazione
                  </p>
                </div>
                <div className="divide-y divide-app-line-10">
                  {r?.per_stato.map((item) => {
                    const cfg = STATO_CONFIG[item.stato] ?? { label: item.stato, color: 'text-gray-400', desc: '' }
                    const pct = r.totale > 0 ? ((item.count / r.totale) * 100).toFixed(1) : '0.0'
                    return (
                      <div key={item.stato} className="flex items-center gap-4 px-4 py-3">
                        <StatoBadge stato={item.stato} />
                        <div className="flex-1">
                          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className={`h-full rounded-full transition-all ${cfg.color.replace('text-', 'bg-')}`}
                              style={{
                                width: `${pct}%`,
                                opacity: 0.6,
                              }}
                            />
                          </div>
                        </div>
                        <span className="w-16 text-right text-sm font-semibold tabular-nums text-app-fg">
                          {item.count}
                        </span>
                        <span className="w-12 text-right text-xs text-app-fg-muted">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              <CollapsibleSection
                title="Documenti bloccati (>7 giorni)"
                count={s?.totale_bloccati ?? 0}
                countColor={s && s.totale_bloccati > 0 ? 'text-rose-300' : 'text-emerald-300'}
              >
                {data.documenti_bloccati.length === 0 ? (
                  <p className="text-sm text-emerald-200/90">Nessun documento bloccato.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-app-fg-muted">
                          <th className="pb-2 pr-3 font-semibold">Stato</th>
                          <th className="pb-2 pr-3 font-semibold">Mittente</th>
                          <th className="pb-2 pr-3 font-semibold">File</th>
                          <th className="pb-2 pr-3 font-semibold">Pending kind</th>
                          <th className="pb-2 pr-3 font-semibold">Giorni</th>
                          <th className="pb-2 pr-3 font-semibold">Creato il</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-line-10">
                        {data.documenti_bloccati.map((doc) => (
                          <tr key={doc.id} className="text-app-fg hover:bg-white/[0.02]">
                            <td className="py-2 pr-3"><StatoBadge stato={doc.stato} /></td>
                            <td className="py-2 pr-3">{doc.mittente ?? '—'}</td>
                            <td className="py-2 pr-3 max-w-[200px] truncate" title={doc.file_name ?? ''}>
                              {doc.file_name ? (
                                doc.file_url ? (
                                  <a
                                    href={doc.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-cyan-300 underline decoration-cyan-500/35 underline-offset-2 hover:text-cyan-200"
                                  >
                                    {doc.file_name}
                                  </a>
                                ) : (
                                  doc.file_name
                                )
                              ) : '—'}
                            </td>
                            <td className="py-2 pr-3">
                              <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px]">
                                {doc.pending_kind ?? '—'}
                              </span>
                            </td>
                            <td className="py-2 pr-3 font-semibold tabular-nums text-rose-200">{doc.giorni_in_stato}g</td>
                            <td className="py-2 pr-3 text-app-fg-muted">
                              {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CollapsibleSection>

              <CollapsibleSection
                title="Documenti da revisionare"
                count={s?.totale_da_revisionare ?? 0}
                countColor={s && s.totale_da_revisionare > 0 ? 'text-rose-300' : 'text-emerald-300'}
              >
                {data.documenti_da_revisionare.length === 0 ? (
                  <p className="text-sm text-emerald-200/90">Nessun documento da revisionare.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-app-fg-muted">
                          <th className="pb-2 pr-3 font-semibold">Mittente</th>
                          <th className="pb-2 pr-3 font-semibold">File</th>
                          <th className="pb-2 pr-3 font-semibold">Pending kind</th>
                          <th className="pb-2 pr-3 font-semibold">Giorni in stato</th>
                          <th className="pb-2 pr-3 font-semibold">Creato il</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-line-10">
                        {data.documenti_da_revisionare.map((doc) => (
                          <tr key={doc.id} className="text-app-fg hover:bg-white/[0.02]">
                            <td className="py-2 pr-3">{doc.mittente ?? '—'}</td>
                            <td className="py-2 pr-3 max-w-[200px] truncate" title={doc.file_name ?? ''}>
                              {doc.file_name ? (
                                doc.file_url ? (
                                  <a
                                    href={doc.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-cyan-300 underline decoration-cyan-500/35 underline-offset-2 hover:text-cyan-200"
                                  >
                                    {doc.file_name}
                                  </a>
                                ) : (
                                  doc.file_name
                                )
                              ) : '—'}
                            </td>
                            <td className="py-2 pr-3">
                              <span className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10px]">
                                {doc.pending_kind ?? '—'}
                              </span>
                            </td>
                            <td className="py-2 pr-3 font-semibold tabular-nums text-rose-200">{doc.giorni_in_stato}g</td>
                            <td className="py-2 pr-3 text-app-fg-muted">
                              {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CollapsibleSection>

              <CollapsibleSection
                title="Statement con problemi"
                count={s?.totale_statement_issues ?? 0}
                countColor={s && s.totale_statement_issues > 0 ? 'text-amber-300' : 'text-emerald-300'}
              >
                {data.statement_con_problemi.length === 0 ? (
                  <p className="text-sm text-emerald-200/90">Nessuno statement con problemi.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-app-fg-muted">
                          <th className="pb-2 pr-3 font-semibold">Fornitore ID</th>
                          <th className="pb-2 pr-3 font-semibold">File</th>
                          <th className="pb-2 pr-3 font-semibold">Righe mancanti</th>
                          <th className="pb-2 pr-3 font-semibold">Creato il</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-line-10">
                        {data.statement_con_problemi.map((stmt) => (
                          <tr key={stmt.id} className="text-app-fg hover:bg-white/[0.02]">
                            <td className="py-2 pr-3 font-mono text-[10px]">{stmt.fornitore_id ?? '—'}</td>
                            <td className="py-2 pr-3 max-w-[200px] truncate" title={stmt.file_url ?? ''}>
                              {stmt.file_url ? (
                                <a
                                  href={stmt.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan-300 underline decoration-cyan-500/35 underline-offset-2 hover:text-cyan-200"
                                >
                                  {stmt.file_url.split('/').pop() ?? stmt.file_url}
                                </a>
                              ) : '—'}
                            </td>
                            <td className="py-2 pr-3 font-semibold tabular-nums text-amber-200">{stmt.missing_rows}</td>
                            <td className="py-2 pr-3 text-app-fg-muted">
                              {stmt.created_at ? new Date(stmt.created_at).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CollapsibleSection>

              <CollapsibleSection
                title="Errori sincronizzazione (24h)"
                count={s?.totale_errori_sincro ?? 0}
                countColor={s && s.totale_errori_sincro > 0 ? 'text-rose-300' : 'text-emerald-300'}
              >
                {data.errori_sincronizzazione_recenti.length === 0 ? (
                  <p className="text-sm text-emerald-200/90">Nessun errore di sincronizzazione nelle ultime 24 ore.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-app-fg-muted">
                          <th className="pb-2 pr-3 font-semibold">Stato</th>
                          <th className="pb-2 pr-3 font-semibold">Sede</th>
                          <th className="pb-2 pr-3 font-semibold">Messaggio</th>
                          <th className="pb-2 pr-3 font-semibold">Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-app-line-10">
                        {data.errori_sincronizzazione_recenti.map((err) => (
                          <tr key={err.id} className="text-app-fg hover:bg-white/[0.02]">
                            <td className="py-2 pr-3">
                              <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                                {err.stato}
                              </span>
                            </td>
                            <td className="py-2 pr-3 font-mono text-[10px] text-app-fg-muted">{err.sede_id ?? '—'}</td>
                            <td className="py-2 pr-3 max-w-[300px] truncate text-app-fg-muted" title={err.message ?? ''}>
                              {err.message ?? '—'}
                            </td>
                            <td className="py-2 pr-3 text-app-fg-muted">
                              {err.data ? new Date(err.data).toLocaleString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CollapsibleSection>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
