'use client'

import { useId, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useLocale } from '@/lib/locale-context'
import { BackButton } from '@/components/BackButton'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderTitleWithDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'
import { APP_PAGE_HEADER_STRIP_H1_CLASS, APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import type { SollecitiReminderSettings } from '@/lib/sollecito-aging'
import { saveSollecitiSettingsAction, type SaveSollecitiSettingsPayload } from './actions'

type Props = {
  initial: SollecitiReminderSettings
  /** Solo form (pagina Impostazioni / cassetto); senza header full-page. */
  variant?: 'page' | 'embedded'
  /** Dopo salvataggio riuscito (es. ricarico dati lato contenitore). */
  onPersisted?: () => void | Promise<void>
}

function numOrZero(v: string): number {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : 0
}

export default function SollecitiSettingsClient({ initial, variant = 'page', onPersisted }: Props) {
  const { t } = useLocale()
  const lt = t.sollecitiSettingsPage
  const embeddedUid = useId()
  const [autoOn, setAutoOn] = useState(initial.autoSollecitiEnabled)
  const [bolla, setBolla] = useState(String(initial.giorniTolBolla))
  const [prom, setProm] = useState(String(initial.giorniTolPromessa))
  const [stmt, setStmt] = useState(String(initial.giorniTolEstrattoMismatch))
  const [msg, setMsg] = useState<'idle' | 'saved' | 'error' | 'forbidden'>('idle')
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const payload: SaveSollecitiSettingsPayload = useMemo(
    () => ({
      autoSolleciti: autoOn ? 1 : 0,
      autoSollecitiEnabled: autoOn,
      giorniTolBolla: Math.min(366, Math.max(0, numOrZero(bolla))),
      giorniTolPromessa: Math.min(366, Math.max(0, numOrZero(prom))),
      giorniTolEstrattoMismatch: Math.min(366, Math.max(0, numOrZero(stmt))),
    }),
    [autoOn, bolla, prom, stmt],
  )

  const submit = () => {
    setMsg('idle')
    setErrorDetail(null)
    startTransition(async () => {
      const res = await saveSollecitiSettingsAction(payload)
      if (res.ok) {
        setMsg('saved')
        try {
          await onPersisted?.()
        } catch {
          /* optional refetch failed */
        }
      } else if (res.error === 'forbidden') setMsg('forbidden')
      else {
        setMsg('error')
        setErrorDetail('details' in res && res.details ? res.details : null)
      }
    })
  }

  if (variant === 'embedded') {
    const bId = `g-bolla-emb-${embeddedUid}`
    const pId = `g-prom-emb-${embeddedUid}`
    const sId = `g-stmt-emb-${embeddedUid}`
    return (
      <div className="space-y-5 sm:space-y-6">
        <p className="text-sm leading-relaxed text-app-fg-muted">{lt.subtitle}</p>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-app-line-30 bg-black/14 px-4 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-app-fg">{lt.automationLabel}</p>
            <p className="mt-1 text-xs leading-snug text-app-fg-muted">{lt.automationHint}</p>
          </div>
          <Switch checked={autoOn} onCheckedChange={setAutoOn} aria-label={lt.automationLabel} />
        </div>

        <div
          className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed ${autoOn ? 'border border-emerald-500/20 bg-emerald-500/8 text-emerald-100/95' : 'border border-app-line-30 bg-black/22 text-app-fg-muted'}`}
        >
          {autoOn ? lt.hintAutomationOn : lt.hintAutomationOff}
        </div>

        <div className="grid gap-5 sm:grid-cols-1">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-app-fg-muted" htmlFor={bId}>
              {lt.daysBollaLabel}
            </label>
            <Input
              id={bId}
              inputMode="numeric"
              disabled={pending}
              value={bolla}
              onChange={(e) => setBolla(e.target.value.replace(/\D/g, '').slice(0, 3))}
              aria-describedby={`${bId}-h`}
              className="max-w-full sm:max-w-[10rem]"
            />
            <p id={`${bId}-h`} className="text-xs text-app-fg-muted">
              {lt.daysBollaHint}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-app-fg-muted" htmlFor={pId}>
              {lt.daysPromiseLabel}
            </label>
            <Input
              id={pId}
              inputMode="numeric"
              disabled={pending}
              value={prom}
              onChange={(e) => setProm(e.target.value.replace(/\D/g, '').slice(0, 3))}
              aria-describedby={`${pId}-h`}
              className="max-w-full sm:max-w-[10rem]"
            />
            <p id={`${pId}-h`} className="text-xs text-app-fg-muted">
              {lt.daysPromiseHint}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-app-fg-muted" htmlFor={sId}>
              {lt.daysStmtLabel}
            </label>
            <Input
              id={sId}
              inputMode="numeric"
              disabled={pending}
              value={stmt}
              onChange={(e) => setStmt(e.target.value.replace(/\D/g, '').slice(0, 3))}
              aria-describedby={`${sId}-h`}
              className="max-w-full sm:max-w-[10rem]"
            />
            <p id={`${sId}-h`} className="text-xs text-app-fg-muted">
              {lt.daysStmtHint}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-app-line-30 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-h-[1.25rem] flex-1 space-y-1">
            {msg === 'saved' ? <span className="text-sm font-semibold text-emerald-300">{lt.savedToast}</span> : null}
            {msg === 'error' ? (
              <span className="text-sm font-semibold text-red-300">
                {lt.errorGeneric}
                {errorDetail ? (
                  <span className="mt-1 block font-mono text-[11px] font-normal text-red-200/90">{errorDetail}</span>
                ) : null}
              </span>
            ) : null}
            {msg === 'forbidden' ? <span className="text-sm font-semibold text-amber-200">{lt.forbidden}</span> : null}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="w-full shrink-0 rounded-xl bg-app-cyan-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-app-cyan-400 disabled:opacity-50 sm:w-auto sm:px-8"
          >
            {pending ? t.common.saving : t.common.save}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-4 text-app-fg md:hidden">
        <AppPageHeaderStrip
          dense
          flushBottom
          accent="slate"
          leadingAccessory={<BackButton href="/impostazioni" label={t.nav.impostazioni} iconOnly className="mb-0 shrink-0" />}
          icon={
            <svg className="h-4 w-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        >
          <AppPageHeaderTitleWithDashboardShortcut className="min-w-0 w-full flex-1">
            <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{lt.title}</h1>
          </AppPageHeaderTitleWithDashboardShortcut>
        </AppPageHeaderStrip>

        <div className="app-card overflow-hidden app-workspace-inset-bg-soft p-4 space-y-5">
          <p className="text-xs leading-relaxed text-app-fg-muted">{lt.subtitle}</p>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-app-line-30 bg-black/14 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-app-fg">{lt.automationLabel}</p>
              <p className="mt-1 text-[11px] leading-snug text-app-fg-muted">{lt.automationHint}</p>
            </div>
            <Switch checked={autoOn} onCheckedChange={setAutoOn} aria-label={lt.automationLabel} />
          </div>

            <div className={`rounded-lg px-3 py-2 text-xs leading-snug ${autoOn ? 'border border-emerald-500/20 bg-emerald-500/8 text-emerald-100/90' : 'border border-app-line-30 bg-black/22 text-app-fg-muted'}`}>
              {autoOn ? lt.hintAutomationOn : lt.hintAutomationOff}
            </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-app-fg-muted" htmlFor="g-bolla-m">{lt.daysBollaLabel}</label>
            <Input
              id="g-bolla-m"
              inputMode="numeric"
              disabled={pending}
              value={bolla}
              onChange={(e) => setBolla(e.target.value.replace(/\D/g, '').slice(0, 3))}
              aria-describedby="g-bolla-m-h"
            />
            <p id="g-bolla-m-h" className="text-[11px] text-app-fg-muted">{lt.daysBollaHint}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-app-fg-muted" htmlFor="g-prom-m">{lt.daysPromiseLabel}</label>
            <Input id="g-prom-m" inputMode="numeric" disabled={pending} value={prom} onChange={(e) => setProm(e.target.value.replace(/\D/g, '').slice(0, 3))} aria-describedby="g-prom-m-h" />
            <p id="g-prom-m-h" className="text-[11px] text-app-fg-muted">{lt.daysPromiseHint}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-app-fg-muted" htmlFor="g-stmt-m">{lt.daysStmtLabel}</label>
            <Input id="g-stmt-m" inputMode="numeric" disabled={pending} value={stmt} onChange={(e) => setStmt(e.target.value.replace(/\D/g, '').slice(0, 3))} aria-describedby="g-stmt-m-h" />
            <p id="g-stmt-m-h" className="text-[11px] text-app-fg-muted">{lt.daysStmtHint}</p>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-app-cyan-500 py-3 text-sm font-bold text-white shadow-[0_0_18px_-6px_rgba(34,211,238,0.45)] hover:bg-app-cyan-400 disabled:opacity-50"
          >
            {pending ? t.common.saving : t.common.save}
          </button>

          {msg === 'saved' ? (
            <p className="text-center text-sm font-semibold text-emerald-300">{lt.savedToast}</p>
          ) : null}
          {msg === 'error' ? (
            <p className="text-center text-sm font-semibold text-red-300">
              {lt.errorGeneric}
              {errorDetail ? (
                <span className="mt-1 block font-mono text-[11px] font-normal text-red-200/90">{errorDetail}</span>
              ) : null}
            </p>
          ) : null}
          {msg === 'forbidden' ? (
            <p className="text-center text-sm font-semibold text-amber-200">{lt.forbidden}</p>
          ) : null}

          <Link href="/impostazioni" className="block text-center text-xs font-semibold text-cyan-300/90 underline-offset-2 hover:underline">
            {lt.backToSettings}
          </Link>
        </div>
      </div>

      <div className={`hidden md:flex flex-col flex-1 min-h-0 w-full ${APP_SHELL_SECTION_PAGE_STACK_CLASS}`}>
        <div className="mx-auto w-full max-w-xl flex-1 py-6 px-4">
          <AppPageHeaderStrip
            dense
            flushBottom
            accent="slate"
            leadingAccessory={<BackButton href="/impostazioni" label={t.nav.impostazioni} iconOnly className="mb-0 shrink-0" />}
            icon={
              <svg className="h-4 w-4 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          >
            <AppPageHeaderTitleWithDashboardShortcut className="min-w-0 w-full flex-1">
              <h1 className={APP_PAGE_HEADER_STRIP_H1_CLASS}>{lt.title}</h1>
            </AppPageHeaderTitleWithDashboardShortcut>
          </AppPageHeaderStrip>

          <div className="app-card mt-3 overflow-hidden app-workspace-inset-bg-soft p-6 space-y-6">
            <p className="text-sm leading-relaxed text-app-fg-muted">{lt.subtitle}</p>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-app-line-30 bg-black/14 px-4 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-app-fg">{lt.automationLabel}</p>
                <p className="mt-1 text-xs leading-snug text-app-fg-muted">{lt.automationHint}</p>
              </div>
              <Switch checked={autoOn} onCheckedChange={setAutoOn} aria-label={lt.automationLabel} />
            </div>

            <div className={`rounded-xl px-3 py-2.5 text-xs leading-relaxed ${autoOn ? 'border border-emerald-500/20 bg-emerald-500/8 text-emerald-100/95' : 'border border-app-line-30 bg-black/22 text-app-fg-muted'}`}>
              {autoOn ? lt.hintAutomationOn : lt.hintAutomationOff}
            </div>

            <div className="grid gap-5 sm:grid-cols-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-app-fg-muted" htmlFor="g-bolla-d">{lt.daysBollaLabel}</label>
                <Input id="g-bolla-d" inputMode="numeric" disabled={pending} value={bolla} onChange={(e) => setBolla(e.target.value.replace(/\D/g, '').slice(0, 3))} aria-describedby="g-bolla-d-h" className="max-w-[10rem]" />
                <p id="g-bolla-d-h" className="text-xs text-app-fg-muted">{lt.daysBollaHint}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-app-fg-muted" htmlFor="g-prom-d">{lt.daysPromiseLabel}</label>
                <Input id="g-prom-d" inputMode="numeric" disabled={pending} value={prom} onChange={(e) => setProm(e.target.value.replace(/\D/g, '').slice(0, 3))} aria-describedby="g-prom-d-h" className="max-w-[10rem]" />
                <p id="g-prom-d-h" className="text-xs text-app-fg-muted">{lt.daysPromiseHint}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-app-fg-muted" htmlFor="g-stmt-d">{lt.daysStmtLabel}</label>
                <Input id="g-stmt-d" inputMode="numeric" disabled={pending} value={stmt} onChange={(e) => setStmt(e.target.value.replace(/\D/g, '').slice(0, 3))} aria-describedby="g-stmt-d-h" className="max-w-[10rem]" />
                <p id="g-stmt-d-h" className="text-xs text-app-fg-muted">{lt.daysStmtHint}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-app-line-30 pt-5">
              {msg === 'saved' ? <span className="text-sm font-semibold text-emerald-300">{lt.savedToast}</span> : null}
              {msg === 'error' ? (
                <span className="text-sm font-semibold text-red-300">
                  {lt.errorGeneric}
                  {errorDetail ? (
                    <span className="mt-1 block font-mono text-[11px] font-normal text-red-200/90">{errorDetail}</span>
                  ) : null}
                </span>
              ) : null}
              {msg === 'forbidden' ? <span className="text-sm font-semibold text-amber-200">{lt.forbidden}</span> : null}
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="rounded-xl bg-app-cyan-500 px-8 py-2.5 text-sm font-bold text-white hover:bg-app-cyan-400 disabled:opacity-50"
              >
                {pending ? t.common.saving : t.common.save}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
