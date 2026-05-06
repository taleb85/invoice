'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/lib/locale-context'
import type { Translations } from '@/lib/translations'
import SedeAddOperatorForm from '@/components/SedeAddOperatorForm'

export type SedeOperatorRow = {
  id: string
  full_name: string | null
  role: string | null
}

type Props = {
  sedeId: string
  operators: SedeOperatorRow[]
  imapInitial: {
    host: string
    port: number
    user: string
    lookbackDays: number | null
  }
}

function roleShortLabel(role: string | null, sedi: Translations['sedi']) {
  switch (role) {
    case 'operatore':
      return sedi.operatoreRoleShort
    case 'admin_sede':
      return sedi.adminSedeRoleShort
    case 'admin_tecnico':
      return sedi.adminTecnicoRoleShort
    case 'admin':
      return sedi.profileRoleAdmin
    default:
      return role?.trim() || '—'
  }
}

export default function SedeBranchManagementPanel({
  sedeId,
  operators,
  imapInitial,
}: Props) {
  const { t } = useLocale()
  const router = useRouter()
  const uid = useId()
  const opToggleId = `sede-op-drawer-${uid}`
  const opRegionId = `sede-op-region-${uid}`

  const [pinSaving, setPinSaving] = useState(false)
  const [pinFeedback, setPinFeedback] = useState<'ok' | 'err' | null>(null)

  const [host, setHost] = useState(imapInitial.host)
  const [port, setPort] = useState(String(imapInitial.port || 993))
  const [user, setUser] = useState(imapInitial.user)
  const [password, setPassword] = useState('')
  const [lookbackDays, setLookbackDays] = useState(
    imapInitial.lookbackDays != null ? String(imapInitial.lookbackDays) : '',
  )
  const [imapSaving, setImapSaving] = useState(false)
  const [imapFeedback, setImapFeedback] = useState<'ok' | 'err' | null>(null)

  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState<string | null>(null)

  const [copiedId, setCopiedId] = useState(false)

  const [operatorsDrawerOpen, setOperatorsDrawerOpen] = useState(true)
  const [pinDraft, setPinDraft] = useState('')

  useEffect(() => {
    const run = () => {
      if (typeof window === 'undefined' || window.location.hash !== '#sede-operatori') return
      window.setTimeout(() => {
        document.getElementById('sede-operatori')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setOperatorsDrawerOpen(true)
      }, 50)
    }
    run()
    window.addEventListener('hashchange', run)
    return () => window.removeEventListener('hashchange', run)
  }, [])

  const copyTechnicalId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sedeId)
      setCopiedId(true)
      window.setTimeout(() => setCopiedId(false), 2000)
    } catch {
      window.prompt(t.sedi.sedeTechnicalIdTitle, sedeId)
    }
  }, [sedeId, t.sedi.sedeTechnicalIdTitle])

  const saveAccessPin = async () => {
    const trimmed = pinDraft.trim()
    const digits = trimmed.replace(/\D/g, '').slice(0, 4)
    if (trimmed !== '' && digits.length !== 4) {
      window.alert(t.sedi.sedePinError4Digits)
      return
    }
    setPinSaving(true)
    setPinFeedback(null)
    try {
      const res = await fetch(`/api/sedi/${encodeURIComponent(sedeId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_password: trimmed === '' ? null : digits,
        }),
      })
      const j = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(j.error ?? 'PIN')
      setPinDraft('')
      setPinFeedback('ok')
      router.refresh()
    } catch (e) {
      setPinFeedback('err')
      window.alert(e instanceof Error ? e.message : t.sedi.branchMgmtPinSaveErr)
    } finally {
      setPinSaving(false)
      window.setTimeout(() => setPinFeedback(null), 2500)
    }
  }

  const canTestImap = host.trim().length > 0 && user.trim().length > 0 && password.trim().length > 0

  const runImapTest = async () => {
    setTestStatus('testing')
    setTestMessage(t.common.loading)
    try {
      const res = await fetch('/api/test-imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: host.trim(),
          port: Number(port) || 993,
          user: user.trim(),
          password: password.trim(),
        }),
      })
      const data = (await res.json()) as { message?: string; error?: string }
      if (!res.ok) {
        setTestStatus('error')
        setTestMessage(data.error ?? 'IMAP')
      } else {
        setTestStatus('ok')
        setTestMessage(data.message ?? 'OK')
      }
    } catch {
      setTestStatus('error')
      setTestMessage(t.common.error)
    }
  }

  const saveImap = async () => {
    setImapSaving(true)
    setImapFeedback(null)
    try {
      const lb = lookbackDays.trim()
      let imapLookback: number | null = null
      if (lb !== '') {
        const n = Math.floor(Number(lb))
        if (!Number.isNaN(n) && n >= 1) imapLookback = Math.min(3650, n)
      }
      const payload: Record<string, unknown> = {
        imap_host: host.trim() || null,
        imap_port: Number(port) || 993,
        imap_user: user.trim() || null,
        imap_lookback_days: imapLookback,
      }
      if (password.trim()) payload.imap_password = password.trim()

      const res = await fetch(`/api/sedi/${encodeURIComponent(sedeId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(j.error ?? 'IMAP')
      setPassword('')
      setImapFeedback('ok')
      router.refresh()
    } catch (e) {
      setImapFeedback('err')
      window.alert(e instanceof Error ? e.message : t.common.error)
    } finally {
      setImapSaving(false)
      window.setTimeout(() => setImapFeedback(null), 2500)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-app-line-25 app-workspace-surface-elevated px-3 py-2 text-sm text-app-fg placeholder:text-app-fg-placeholder focus:outline-none focus:ring-2 focus:ring-app-line-40 [color-scheme:dark]'
  const labelCls = 'mb-1 block text-xs font-medium text-app-fg-muted'

  return (
    <div className="mb-6 flex flex-col gap-6">
      {/* Identificativo + codice accesso */}
      <div className="app-card overflow-hidden">
        <div className="space-y-4 px-5 py-4 app-workspace-inset-bg-soft sm:px-6 sm:py-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">
              {t.sedi.sedeTechnicalIdTitle}
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <code className="min-w-0 flex-1 break-all rounded-lg border border-app-line-25 bg-black/25 px-3 py-2 font-mono text-[11px] text-app-fg-muted">
                {sedeId}
              </code>
              <button
                type="button"
                onClick={() => void copyTechnicalId()}
                className="inline-flex shrink-0 touch-manipulation items-center justify-center gap-2 rounded-lg border border-app-line-35 bg-black/20 px-3 py-2 text-xs font-semibold text-app-fg transition-colors hover:border-app-a-45 hover:bg-black/30"
                aria-label={t.sedi.copyTechnicalIdAria}
              >
                {copiedId ? t.common.success : t.sedi.copyTechnicalIdButton}
              </button>
            </div>
          </div>

          <div className="border-t border-app-soft-border pt-4">
            <label htmlFor={`${uid}-access-pin`} className={labelCls}>
              {t.sedi.sedeAccessCodeLabel}
            </label>
            <p className="mb-2 text-xs leading-snug text-app-fg-muted">{t.sedi.sedePinHint}</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <input
                id={`${uid}-access-pin`}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                value={pinDraft}
                onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className={`${inputCls} sm:max-w-[10rem]`}
                placeholder="••••"
              />
              <button
                type="button"
                disabled={pinSaving}
                onClick={() => void saveAccessPin()}
                className="inline-flex touch-manipulation items-center justify-center rounded-lg border border-app-line-35 bg-app-line-15 px-4 py-2 text-xs font-semibold text-app-fg transition-colors hover:bg-app-line-25 disabled:opacity-50"
              >
                {pinSaving ? t.common.loading : t.sedi.saveAccessPinBtn}
              </button>
            </div>
            {pinFeedback === 'ok' ? (
              <p className="mt-2 text-xs font-medium text-emerald-300">{t.sedi.branchMgmtPinSaved}</p>
            ) : null}
            {pinFeedback === 'err' ? (
              <p className="mt-2 text-xs font-medium text-red-300">{t.sedi.branchMgmtPinSaveErr}</p>
            ) : null}
          </div>
        </div>
      </div>

      {/* IMAP */}
      <div className="app-card overflow-hidden">
        <div className="border-b border-app-line-15 px-5 py-4 app-workspace-inset-bg-soft">
          <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{t.sedi.imap}</p>
          <p className="mt-1 text-xs leading-snug text-app-fg-muted">{t.sedi.imapSubtitle}</p>
        </div>
        <div className="space-y-4 px-5 py-4 app-workspace-inset-bg-soft sm:px-6 sm:py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelCls} htmlFor={`${uid}-imap-host`}>
                {t.sedi.imapHost}
              </label>
              <input
                id={`${uid}-imap-host`}
                className={inputCls}
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder={t.sedi.imapHostPlaceholder}
                autoComplete="off"
              />
            </div>
            <div>
              <label className={labelCls} htmlFor={`${uid}-imap-port`}>
                {t.sedi.imapPort}
              </label>
              <input
                id={`${uid}-imap-port`}
                type="number"
                className={inputCls}
                value={port}
                onChange={(e) => setPort(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor={`${uid}-imap-lb`}>
                {t.sedi.imapLookbackLabel}
              </label>
              <input
                id={`${uid}-imap-lb`}
                type="number"
                min={1}
                className={inputCls}
                value={lookbackDays}
                onChange={(e) => setLookbackDays(e.target.value)}
                placeholder="—"
              />
              <p className="mt-1 text-[11px] leading-snug text-app-fg-muted">{t.sedi.imapLookbackHint}</p>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls} htmlFor={`${uid}-imap-user`}>
                {t.sedi.imapUser}
              </label>
              <input
                id={`${uid}-imap-user`}
                type="email"
                className={inputCls}
                value={user}
                onChange={(e) => setUser(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls} htmlFor={`${uid}-imap-pass`}>
                {t.sedi.imapPassword}
              </label>
              <input
                id={`${uid}-imap-pass`}
                type="password"
                className={inputCls}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.sedi.imapPasswordPlaceholder}
                autoComplete="new-password"
              />
              <p className="mt-1 text-[11px] leading-snug text-app-fg-muted">{t.sedi.imapPasswordLeaveBlankHint}</p>
            </div>
          </div>

          {testStatus !== 'idle' ? (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${
                testStatus === 'ok'
                  ? 'border-emerald-500/35 bg-emerald-950/25 text-emerald-200'
                  : testStatus === 'error'
                    ? 'border-rose-500/35 bg-rose-950/25 text-rose-200'
                    : 'border-app-line-25 bg-black/20 text-app-fg-muted'
              }`}
            >
              {testStatus === 'testing' ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {t.common.loading}
                </span>
              ) : (
                testMessage
              )}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={!canTestImap || testStatus === 'testing'}
              onClick={() => void runImapTest()}
              className="inline-flex touch-manipulation items-center justify-center rounded-lg border border-app-line-35 bg-black/20 px-4 py-2.5 text-xs font-semibold text-app-fg transition-colors hover:border-app-a-45 hover:bg-black/30 disabled:opacity-45"
            >
              {t.sedi.testConnection}
            </button>
            <button
              type="button"
              disabled={imapSaving}
              onClick={() => void saveImap()}
              className="inline-flex touch-manipulation items-center justify-center rounded-lg bg-app-cyan-500 px-4 py-2.5 text-xs font-bold text-cyan-950 shadow-sm transition-colors hover:bg-app-cyan-400 disabled:opacity-50"
            >
              {imapSaving ? t.common.loading : t.sedi.saveConfig}
            </button>
          </div>
          {imapFeedback === 'ok' ? (
            <p className="text-xs font-medium text-emerald-300">{t.common.success}</p>
          ) : null}
        </div>
      </div>

      {/* Operatori — cassetto */}
      <div id="sede-operatori" className="scroll-mt-24 app-card overflow-hidden">
        <button
          type="button"
          id={opToggleId}
          aria-expanded={operatorsDrawerOpen}
          aria-controls={operatorsDrawerOpen ? opRegionId : undefined}
          aria-label={
            operatorsDrawerOpen ? t.sedi.operatorsDrawerAriaClose : t.sedi.operatorsDrawerAriaOpen
          }
          onClick={() => setOperatorsDrawerOpen((o) => !o)}
          className="flex w-full touch-manipulation items-start gap-4 px-5 py-4 text-left outline-none ring-app-cyan-500/40 transition hover:bg-black/[0.06] focus-visible:ring-2 sm:px-6"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/12 ring-1 ring-violet-500/25">
            <svg className="h-5 w-5 text-violet-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">
              {t.sedi.operatoriHeader.replace('{n}', String(operators.length))}
            </p>
            {!operatorsDrawerOpen ? (
              <p className="mt-1 text-xs leading-snug text-app-fg-muted">{t.sedi.operatorsDrawerCollapsedHint}</p>
            ) : null}
          </div>
          <svg
            className={`mt-2 h-5 w-5 shrink-0 text-app-fg-muted transition-transform duration-200 ${operatorsDrawerOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {operatorsDrawerOpen ? (
          <div
            id={opRegionId}
            role="region"
            aria-labelledby={opToggleId}
            className="border-t border-app-line-15 px-5 py-4 app-workspace-inset-bg-soft sm:px-6 sm:py-5"
          >
            {operators.length === 0 ? (
              <p className="mb-4 text-sm text-app-fg-muted">{t.sedi.nessunUtente}</p>
            ) : (
              <ul className="mb-5 space-y-2">
                {operators.map((op) => (
                  <li
                    key={op.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-app-line-20 bg-black/15 px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-app-fg">{op.full_name?.trim() || '—'}</span>
                    <span className="rounded-md bg-app-line-15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted">
                      {roleShortLabel(op.role, t.sedi)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mb-4 text-xs leading-relaxed text-app-fg-muted">{t.sedi.operatorsRosterReadOnlyHint}</p>
            <div className="border-t border-app-soft-border pt-4">
              <SedeAddOperatorForm sedeId={sedeId} embedded />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
