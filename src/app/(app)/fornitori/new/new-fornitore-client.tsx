'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useSedeId } from '@/lib/use-sede'
import { useMe } from '@/lib/me-context'
import { useActiveOperator } from '@/lib/active-operator-context'
import { effectiveIsAdminSedeUi, effectiveIsMasterAdminPlane } from '@/lib/effective-operator-ui'
import { useT } from '@/lib/use-t'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { AppPageHeaderDashboardShortcut } from '@/components/AppPageHeaderDashboardShortcut'

const fieldBaseCls =
  'w-full rounded-xl border border-slate-600/60 bg-slate-700 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 transition [color-scheme:dark] focus:border-cyan-500/50 focus:outline-none focus:ring-2 focus:ring-cyan-500/50'
const inputCls = `${fieldBaseCls} appearance-none`
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-cyan-400/80'

export default function NewFornitoreForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { sedeId: ctxSede } = useSedeId()
  const { me } = useMe()
  const { activeOperator } = useActiveOperator()
  const t = useT()
  const prefillSedeParam = searchParams.get('prefill_sede_id')
  const preSede = prefillSedeParam?.trim() || ''
  const sedeId =
    effectiveIsMasterAdminPlane(me, activeOperator) && preSede
      ? preSede
      : effectiveIsAdminSedeUi(me, activeOperator) && preSede && me?.sede_id && preSede === me.sede_id
        ? preSede
        : ctxSede
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome: '',
    display_name: '',
    email: '',
    piva: '',
    indirizzo: '',
  })

  useEffect(() => {
    const n = searchParams.get('prefill_nome')
    const p = searchParams.get('prefill_piva')
    const e = searchParams.get('prefill_email')
    const a = searchParams.get('prefill_indirizzo')
    setForm((prev) => ({
      ...prev,
      nome: n?.trim() || prev.nome,
      piva: p?.trim() || prev.piva,
      email: e?.trim().toLowerCase() || prev.email,
      indirizzo: a?.trim() || prev.indirizzo,
    }))
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const { data: row, error: err } = await supabase
      .from('fornitori')
      .insert([
        {
          nome: form.nome,
          display_name: form.display_name.trim().toLocaleUpperCase() || null,
          email: form.email || null,
          piva: form.piva || null,
          indirizzo: form.indirizzo.trim() || null,
          sede_id: sedeId,
        },
      ])
      .select('id')
      .single()

    if (err) {
      setSaving(false)
      setError(err.message)
      return
    }

    const newId = row?.id
    const rememberMittente = searchParams.get('remember_mittente')?.trim().toLowerCase()
    const emailNorm = form.email?.trim().toLowerCase()
    if (newId && rememberMittente?.includes('@')) {
      await fetch('/api/fornitore-emails/remember', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fornitore_id: newId, email: rememberMittente }),
      })
    } else if (newId && emailNorm?.includes('@')) {
      await fetch('/api/fornitore-emails/remember', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fornitore_id: newId, email: emailNorm }),
      })
    }

    setSaving(false)
    router.push('/fornitori')
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-lg app-shell-page-padding">
      <AppPageHeaderStrip>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <AppPageHeaderDashboardShortcut dashboardLabel={t.nav.dashboard} />
          <button
            type="button"
            onClick={() => router.back()}
            className="shrink-0 text-slate-200 transition-colors hover:text-cyan-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="app-page-title min-w-0 text-2xl font-bold tracking-tight">{t.fornitori.new}</h1>
        </div>
      </AppPageHeaderStrip>

      <form onSubmit={handleSubmit} className="app-card">
        <div className="app-card-bar" aria-hidden />
        <div className="space-y-4 p-6">
          <div>
            <label className={labelCls}>{t.fornitori.nome} *</label>
            <input
              className={inputCls}
              required
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder={t.fornitori.namePlaceholder}
            />
          </div>
          <div>
            <label className={labelCls}>{t.fornitori.displayNameLabel}</label>
            <input
              className={`${inputCls} uppercase`}
              autoCapitalize="characters"
              value={form.display_name}
              onChange={(e) =>
                setForm({ ...form, display_name: e.target.value.toLocaleUpperCase() })
              }
              placeholder={t.fornitori.displayNamePlaceholder}
            />
            <p className="mt-1 text-[11px] text-slate-200">{t.fornitori.displayNameHint}</p>
          </div>
          <div>
            <label className={labelCls}>{t.fornitori.email}</label>
            <input
              type="email"
              className={inputCls}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder={t.fornitori.emailPlaceholder}
            />
          </div>
          <div>
            <label className={labelCls}>{t.fornitori.pivaLabel}</label>
            <input
              className={inputCls}
              value={form.piva}
              onChange={(e) => setForm({ ...form, piva: e.target.value })}
              placeholder={t.fornitori.pivaPlaceholder}
            />
          </div>
          <div>
            <label className={labelCls}>{t.fornitori.addressLabel}</label>
            <input
              className={inputCls}
              value={form.indirizzo}
              onChange={(e) => setForm({ ...form, indirizzo: e.target.value })}
              placeholder={t.fornitori.addressPlaceholder}
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2.5 text-sm text-red-300">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 rounded-xl border border-slate-600/80 bg-slate-700/80 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/80"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-cyan-500 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-60"
            >
              {saving ? t.fornitori.saving : t.common.save}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
