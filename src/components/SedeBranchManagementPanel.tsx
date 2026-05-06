'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from '@/lib/locale-context'
import { useMe } from '@/lib/me-context'
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

function SedeOperatorRowEditor({
  op,
  inputCls,
  rowUid,
}: {
  op: SedeOperatorRow
  inputCls: string
  rowUid: string
}) {
  const { t } = useLocale()
  const router = useRouter()
  const { me } = useMe()

  const displayLabel = op.full_name?.trim() || '—'
  const savedRole = String(op.role ?? '').toLowerCase()
  const isSelf = Boolean(me?.user?.id && op.id === me.user.id)
  const isMaster = Boolean(me?.is_admin)
  const canManageBranchUsers =
    Boolean(me?.user?.id) && (isMaster || me?.is_admin_sede || me?.is_admin_tecnico)
  /** Ruolo: solo portale master o responsabile sede (`admin_sede`), non admin tecnico. */
  const canAssignRoles = Boolean(me?.is_admin || me?.is_admin_sede)
  const roleEditable = canManageBranchUsers && canAssignRoles

  const [nameDraft, setNameDraft] = useState(op.full_name?.trim() ?? '')
  const [roleDraft, setRoleDraft] = useState(savedRole || 'operatore')
  useEffect(() => {
    setNameDraft(op.full_name?.trim() ?? '')
    setRoleDraft(savedRole || 'operatore')
  }, [op.full_name, op.id, savedRole])

  const normalizedSaved = (op.full_name ?? '').trim().toUpperCase()
  const normalizedDraft = nameDraft.trim().toUpperCase()
  const nameDirty = normalizedDraft !== normalizedSaved
  const roleDirty = roleDraft !== savedRole
  const rowDirty = nameDirty || roleDirty

  const effectiveRole = roleDraft
  const isOperatoreRow = effectiveRole === 'operatore'

  const roleOptions: { value: string; label: string }[] = []
  if (isMaster) {
    roleOptions.push(
      { value: 'operatore', label: t.sedi.operatoreRole },
      { value: 'admin_sede', label: t.sedi.adminSedeRole },
      { value: 'admin_tecnico', label: t.sedi.adminTecnicoRole },
      { value: 'admin', label: t.sedi.profileRoleAdmin },
    )
  } else if (canManageBranchUsers) {
    roleOptions.push(
      { value: 'operatore', label: t.sedi.operatoreRole },
      { value: 'admin_sede', label: t.sedi.adminSedeRole },
      { value: 'admin_tecnico', label: t.sedi.adminTecnicoRole },
    )
  }

  const rowToolbarPad = 'py-2 px-2.5 text-xs leading-snug'
  const controlCls = `${inputCls} ${rowToolbarPad} min-h-[38px]`
  const selectCls = `${controlCls} min-w-0 flex-1 basis-0 !w-auto max-w-full cursor-pointer`

  const [profileSaving, setProfileSaving] = useState(false)
  const saveProfile = async () => {
    if (!rowDirty) return
    const body: { full_name?: string; role?: string } = {}
    if (nameDirty) {
      const fn = nameDraft.trim().toUpperCase()
      if (!fn) {
        window.alert(t.sedi.operatorNameRequired)
        return
      }
      body.full_name = fn
    }
    if (roleDirty) {
      if (!roleEditable) return
      body.role = roleDraft
    }
    if (Object.keys(body).length === 0) return
    setProfileSaving(true)
    try {
      const res = await fetch(`/api/profiles/${encodeURIComponent(op.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        window.alert(j.error ?? t.common.error)
        return
      }
      router.refresh()
    } finally {
      setProfileSaving(false)
    }
  }

  const [pinOpen, setPinOpen] = useState(false)
  const [pinDraft, setPinDraft] = useState('')
  const [pinSaving, setPinSaving] = useState(false)
  const savePin = async () => {
    if (pinDraft.length < 4) {
      window.alert(t.sedi.operatorPinTooShort)
      return
    }
    setPinSaving(true)
    try {
      const res = await fetch('/api/operator/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId: op.id, newPin: pinDraft }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        window.alert(j.error ?? t.common.error)
        return
      }
      setPinDraft('')
      setPinOpen(false)
      router.refresh()
    } finally {
      setPinSaving(false)
    }
  }

  const [delBusy, setDelBusy] = useState(false)
  const deleteOperator = async () => {
    const nm = displayLabel === '—' ? op.id.slice(0, 8) : displayLabel
    if (!window.confirm(t.sedi.operatorDeleteConfirm.replace('{name}', nm))) return
    setDelBusy(true)
    try {
      const res = await fetch('/api/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: op.id }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        window.alert(j.error ?? t.common.error)
        return
      }
      router.refresh()
    } finally {
      setDelBusy(false)
    }
  }

  const btnSecondary =
    `inline-flex h-[38px] max-w-full shrink-0 touch-manipulation items-center justify-center whitespace-nowrap rounded-lg border border-app-line-35 bg-black/20 px-3 text-xs font-semibold leading-none text-app-fg transition-colors hover:border-app-a-45 hover:bg-black/30 disabled:opacity-45`
  const btnDanger =
    `inline-flex h-[38px] max-w-full shrink-0 touch-manipulation items-center justify-center whitespace-nowrap rounded-lg border border-rose-500/40 bg-rose-950/25 px-3 text-xs font-semibold leading-none text-rose-100 transition-colors hover:border-rose-400/55 hover:bg-rose-950/40 disabled:opacity-45`
  const btnPrimary =
    `inline-flex h-[38px] shrink-0 touch-manipulation items-center justify-center whitespace-nowrap rounded-lg bg-app-cyan-500 px-3 text-xs font-bold leading-none text-cyan-950 shadow-sm transition-colors hover:bg-app-cyan-400 disabled:opacity-50`

  const knownRoleValues = new Set(roleOptions.map((o) => o.value))

  return (
    <li className="min-w-0 rounded-lg border border-app-line-20 bg-black/15 px-2 py-1.5 text-sm">
      <div className="flex min-w-0 flex-nowrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            id={`${rowUid}-name`}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value.toUpperCase())}
            className={`${controlCls} !w-[15rem] shrink-0`}
            autoComplete="off"
            placeholder={t.sedi.operatorDisplayNameLabel}
            aria-label={t.sedi.operatorDisplayNameLabel}
          />
          {roleOptions.length > 0 ? (
            <select
              id={`${rowUid}-role`}
              value={roleDraft}
              disabled={!roleEditable}
              onChange={(e) => setRoleDraft(e.target.value)}
              className={selectCls}
              aria-label={t.common.role}
            >
              {!knownRoleValues.has(roleDraft) && roleDraft ? (
                <option value={roleDraft}>{roleShortLabel(roleDraft, t.sedi)}</option>
              ) : null}
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <span
              className={`inline-flex h-[38px] min-w-[8rem] flex-1 items-center rounded-lg border border-app-line-25 bg-app-line-15 px-2.5 text-xs font-semibold leading-snug text-app-fg-muted`}
            >
              {roleShortLabel(op.role, t.sedi)}
            </span>
          )}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={profileSaving || !rowDirty}
            onClick={() => void saveProfile()}
            className={btnPrimary}
          >
            {profileSaving ? t.common.loading : t.common.save}
          </button>
          {isOperatoreRow && !isSelf ? (
            <>
              <button type="button" className={btnSecondary} onClick={() => setPinOpen((o) => !o)}>
                {t.sedi.changePinTitle}
              </button>
              <button
                type="button"
                className={btnDanger}
                disabled={delBusy}
                onClick={() => void deleteOperator()}
              >
                {delBusy ? t.common.loading : t.sedi.deleteTitle}
              </button>
            </>
          ) : null}
        </div>
      </div>
      {isOperatoreRow && !isSelf && pinOpen ? (
        <div className="mt-2 space-y-2 border-t border-app-line-18 pt-2">
          <label className="block text-xs text-app-fg-muted" htmlFor={`${rowUid}-pin`}>
            {t.sedi.newPinFor.replace('{name}', displayLabel)}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`${rowUid}-pin`}
              type="password"
              value={pinDraft}
              onChange={(e) => setPinDraft(e.target.value)}
              className={`${controlCls} max-w-[12rem]`}
              autoComplete="new-password"
            />
            <button type="button" disabled={pinSaving} onClick={() => void savePin()} className={btnPrimary}>
              {pinSaving ? t.common.loading : t.common.save}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  )
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
      <div id="sede-operatori" className="scroll-mt-24 app-card !overflow-visible">
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
              <ul className="mb-5 flex list-none flex-col gap-3">
                {operators.map((op) => (
                  <SedeOperatorRowEditor key={op.id} op={op} inputCls={inputCls} rowUid={`${uid}-op-${op.id}`} />
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
