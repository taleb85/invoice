'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { Sede, Profile } from '@/types'
import { useT } from '@/lib/use-t'
import { getLocale, COUNTRY_OPTIONS } from '@/lib/localization'
import { CURRENCIES, TIMEZONES } from '@/lib/translations'

/* ─── IP geo-detection ─────────────────────────────────────────────────────
   Maps the ISO-2 country code returned by ipapi.co to our internal codes.
   GB → UK; everything else: match if supported, else fall back to UK.      */
const GEO_MAP: Record<string, string> = { GB: 'UK', UK: 'UK', FR: 'FR', DE: 'DE', IT: 'IT', ES: 'ES' }

async function detectCountryByIp(): Promise<{ code: string; detected: boolean }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return { code: 'UK', detected: false }
    const data = await res.json() as { country_code?: string }
    const raw = (data.country_code ?? '').toUpperCase()
    const code = GEO_MAP[raw] ?? 'UK'
    return { code, detected: !!GEO_MAP[raw] }
  } catch {
    clearTimeout(timer)
    return { code: 'UK', detected: false }
  }
}

interface SedeWithCounts extends Sede {
  fornitori_count: number
  bolle_count: number
  fatture_count: number
  users_count: number
  imap_host: string | null
  imap_port: number | null
  imap_user: string | null
  imap_password: string | null
  imap_lookback_days: number | null
  access_password: string | null
}

interface ProfileWithSede extends Profile {
  sedi: Sede | null
}

interface ImapForm {
  imap_host: string
  imap_port: string
  imap_user: string
  imap_password: string
  imap_lookback_days: string
}

export default function SediPage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useT()

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  /** `sede` = admin con `profiles.sede_id`: solo quella sede, niente wizard / utenti senza sede. */
  const [adminListScope, setAdminListScope] = useState<'global' | 'sede'>('global')
  const [sedi, setSedi] = useState<SedeWithCounts[]>([])
  const [profiles, setProfiles] = useState<ProfileWithSede[]>([])
  const [allSedi, setAllSedi] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)

  // ── Wizard nuova sede ──
  const [showWizard, setShowWizard] = useState(false)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1)
  const [wizardSedeName, setWizardSedeName] = useState('')
  const [wizardImap, setWizardImap] = useState<ImapForm>({ imap_host: '', imap_port: '993', imap_user: '', imap_password: '', imap_lookback_days: '30' })
  const [wizardOperators, setWizardOperators] = useState<{ name: string; pin: string }[]>([])
  const [wizardNewOpName, setWizardNewOpName] = useState('')
  const [wizardNewOpPin, setWizardNewOpPin] = useState('')
  const [wizardShowImap, setWizardShowImap] = useState(false)
  const [wizardShowPin, setWizardShowPin] = useState(false)
  const [creatingWizard, setCreatingWizard] = useState(false)
  const [wizardError, setWizardError] = useState<string | null>(null)

  // ── Wizard — geo-detection ──
  const [wizardCountryCode, setWizardCountryCode] = useState('UK')
  const [wizardGeoStatus, setWizardGeoStatus] = useState<'detecting' | 'detected' | 'failed'>('detecting')

  const openWizard = () => {
    if (adminListScope === 'sede') return
    setWizardStep(1); setWizardSedeName(''); setWizardError(null)
    setWizardImap({ imap_host: '', imap_port: '993', imap_user: '', imap_password: '', imap_lookback_days: '30' })
    setWizardOperators([]); setWizardNewOpName(''); setWizardNewOpPin('')
    setWizardShowImap(false); setWizardShowPin(false)
    setWizardCountryCode('UK'); setWizardGeoStatus('detecting')
    setShowWizard(true)
    detectCountryByIp().then(({ code, detected }) => {
      setWizardCountryCode(code)
      setWizardGeoStatus(detected ? 'detected' : 'failed')
    })
  }

  const addWizardOperator = () => {
    if (!wizardNewOpName.trim() || String(wizardNewOpPin).length < 4) return
    setWizardOperators([...wizardOperators, { name: wizardNewOpName.trim(), pin: wizardNewOpPin }])
    setWizardNewOpName(''); setWizardNewOpPin('')
  }

  const handleWizardCreate = async () => {
    if (adminListScope === 'sede') return
    setCreatingWizard(true); setWizardError(null)
    const { data: newSede, error: sedeErr } = await supabase
      .from('sedi').insert([{ nome: wizardSedeName.trim(), country_code: wizardCountryCode }]).select().single()
    if (sedeErr || !newSede) { setWizardError(sedeErr?.message ?? 'Errore nella creazione della sede.'); setCreatingWizard(false); return }

    if (wizardImap.imap_host.trim() && wizardImap.imap_user.trim()) {
      await supabase.from('sedi').update({
        imap_host: wizardImap.imap_host.trim(),
        imap_port: parseInt(wizardImap.imap_port) || 993,
        imap_user: wizardImap.imap_user.trim(),
        imap_password: wizardImap.imap_password || null,
      }).eq('id', newSede.id)
    }

    for (const op of wizardOperators) {
      await fetch('/api/create-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: op.name, pin: op.pin, sedeId: newSede.id, role: 'operatore' }),
      })
    }

    setCreatingWizard(false); setShowWizard(false)
    setSuccessMsg(`Sede "${wizardSedeName}" creata con successo.`)
    setTimeout(() => setSuccessMsg(null), 3000)
    await loadData()
  }

  // Legacy state (mantenuto per handleAddSede, non visibile nell'UI)
  const [newSedeName, setNewSedeName] = useState('')
  const [addingSede, setAddingSede] = useState(false)

  // Edit sede name
  const [editingSede, setEditingSede] = useState<{ id: string; nome: string } | null>(null)

  // Edit utente inline
  const [editingProfile, setEditingProfile] = useState<{ id: string; full_name: string; role: string } | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const handleSaveProfile = async () => {
    if (!editingProfile) return
    setSavingProfile(true)
    const { error: err } = await supabase
      .from('profiles')
      .update({ full_name: editingProfile.full_name.trim() || null, role: editingProfile.role })
      .eq('id', editingProfile.id)
    setSavingProfile(false)
    if (err) { setError(err.message); return }
    setEditingProfile(null)
    await loadData()
  }

  // Elimina utente
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Eliminare l'utente ${email}? Questa azione è irreversibile.`)) return
    setDeletingUserId(userId)
    const res = await fetch('/api/delete-user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const data = await res.json()
    setDeletingUserId(null)
    if (!res.ok) { setError(data.error); return }
    await loadData()
  }

  // Crea operatore
  const [createUserOpen, setCreateUserOpen] = useState<string | null>(null)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [showNewUserPw, setShowNewUserPw] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)
  const [createUserMsg, setCreateUserMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleCreateUser = async (sedeId: string) => {
    setCreatingUser(true)
    setCreateUserMsg(null)
    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newUserName, pin: newUserPassword, sedeId, role: 'operatore' }),
    })
    const data = await res.json()
    setCreatingUser(false)
    if (res.ok) {
      setCreateUserMsg({ ok: true, text: data.message })
      setNewUserEmail('')
      setNewUserPassword('')
      await loadData()
    } else {
      setCreateUserMsg({ ok: false, text: data.error })
    }
  }

  // Codice accesso sede
  const [accessPwOpen, setAccessPwOpen] = useState<string | null>(null)
  const [accessPwValue, setAccessPwValue] = useState('')
  const [showAccessPw, setShowAccessPw] = useState(false)
  const [savingAccessPw, setSavingAccessPw] = useState(false)

  const handleSaveAccessPassword = async (sedeId: string) => {
    setSavingAccessPw(true)
    const { error } = await supabase.from('sedi').update({
      access_password: accessPwValue.trim() || null,
    }).eq('id', sedeId)
    setSavingAccessPw(false)
    if (error) {
      setError(error.message)
      return
    }
    setAccessPwOpen(null)
    setAccessPwValue('')
    await loadData()
  }

  // IMAP config per sede
  const [imapOpen, setImapOpen] = useState<string | null>(null)
  const [imapForm, setImapForm] = useState<ImapForm>({ imap_host: '', imap_port: '993', imap_user: '', imap_password: '', imap_lookback_days: '30' })
  const [savingImap, setSavingImap] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [testingImap, setTestingImap] = useState(false)
  const [imapTestResult, setImapTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  // Localizzazione sede (currency + timezone)
  const [locOpen, setLocOpen]         = useState<string | null>(null)
  const [locCurrency, setLocCurrency] = useState('GBP')
  const [locTimezone, setLocTimezone] = useState('Europe/London')
  const [savingLoc, setSavingLoc]     = useState(false)

  const openLocForm = (sede: SedeWithCounts) => {
    setLocOpen(sede.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = sede as any
    setLocCurrency(s.currency ?? 'GBP')
    setLocTimezone(s.timezone ?? 'Europe/London')
  }

  const handleSaveLoc = async (sedeId: string) => {
    setSavingLoc(true)
    const res = await fetch(`/api/sedi/${sedeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currency: locCurrency, timezone: locTimezone }),
    })
    setSavingLoc(false)
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Error saving localisation')
      return
    }
    setLocOpen(null)
    setSuccessMsg('Localizzazione salvata.')
    setTimeout(() => setSuccessMsg(null), 3000)
    await loadData()
  }

  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadData = async () => {
    const res = await fetch('/api/sedi')

    if (res.status === 401) { router.push('/login'); return }
    if (res.status === 403) { setIsAdmin(false); setLoading(false); return }

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Errore caricamento dati')
      setLoading(false)
      return
    }

    setIsAdmin(true)
    const data = await res.json()
    const scope: 'global' | 'sede' = data.adminListScope === 'sede' ? 'sede' : 'global'
    setAdminListScope(scope)
    setSedi(data.sedi ?? [])
    setAllSedi(data.sedi ?? [])
    setProfiles((data.profiles ?? []) as ProfileWithSede[])
    setLoading(false)
  }

  useEffect(() => { loadData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (adminListScope === 'sede' && showWizard) setShowWizard(false)
  }, [adminListScope, showWizard])

  const handleAddSede = async (e: React.FormEvent) => {
    e.preventDefault()
    if (adminListScope === 'sede') return
    if (!newSedeName.trim()) return
    setAddingSede(true)
    setError(null)
    const { error: err } = await supabase.from('sedi').insert([{ nome: newSedeName.trim() }])
    setAddingSede(false)
    if (err) { setError(err.message); return }
    setNewSedeName('')
    setSuccessMsg('Sede aggiunta con successo.')
    setTimeout(() => setSuccessMsg(null), 3000)
    await loadData()
  }

  const handleUpdateSede = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSede) return
    setError(null)
    const { error: err } = await supabase.from('sedi').update({ nome: editingSede.nome }).eq('id', editingSede.id)
    if (err) { setError(err.message); return }
    setEditingSede(null)
    setSuccessMsg('Sede aggiornata.')
    setTimeout(() => setSuccessMsg(null), 3000)
    await loadData()
  }

  const handleDeleteSede = async (id: string, nome: string) => {
    if (adminListScope === 'sede') return
    if (!confirm(`Elimina la sede "${nome}"? I dati collegati rimarranno ma perderanno il riferimento alla sede.`)) return
    setError(null)
    const { error: err } = await supabase.from('sedi').delete().eq('id', id)
    if (err) { setError(err.message); return }
    setSuccessMsg('Sede eliminata.')
    setTimeout(() => setSuccessMsg(null), 3000)
    await loadData()
  }

  const handleUpdateProfile = async (profileId: string, field: 'sede_id' | 'role', value: string) => {
    setError(null)
    const { error: err } = await supabase.from('profiles').update({ [field]: value || null }).eq('id', profileId)
    if (err) { setError(err.message); return }
    setSuccessMsg('Utente aggiornato.')
    setTimeout(() => setSuccessMsg(null), 2000)
    await loadData()
  }

  const openImapForm = (sede: SedeWithCounts) => {
    setImapOpen(sede.id)
    setImapTestResult(null)
    setShowPassword(false)
    setImapForm({
      imap_host: sede.imap_host ?? '',
      imap_port: String(sede.imap_port ?? 993),
      imap_user: sede.imap_user ?? '',
      imap_password: sede.imap_password ?? '',
      imap_lookback_days: String(sede.imap_lookback_days ?? 30),
    })
  }

  const handleSaveImap = async (sedeId: string) => {
    setSavingImap(true)
    setError(null)
    const lookbackVal = parseInt(imapForm.imap_lookback_days)
    const { error: err } = await supabase.from('sedi').update({
      imap_host: imapForm.imap_host.trim() || null,
      imap_port: parseInt(imapForm.imap_port) || 993,
      imap_user: imapForm.imap_user.trim() || null,
      imap_password: imapForm.imap_password || null,
      imap_lookback_days: isNaN(lookbackVal) || lookbackVal <= 0 ? null : lookbackVal,
    }).eq('id', sedeId)
    setSavingImap(false)
    if (err) { setError(err.message); return }
    setSuccessMsg('Configurazione email salvata.')
    setTimeout(() => setSuccessMsg(null), 3000)
    setImapOpen(null)
    await loadData()
  }

  const handleTestImap = async (sedeId: string) => {
    setTestingImap(true)
    setImapTestResult(null)
    try {
      const res = await fetch('/api/test-imap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: imapForm.imap_host,
          port: parseInt(imapForm.imap_port) || 993,
          user: imapForm.imap_user,
          password: imapForm.imap_password,
          sedeId,
        }),
      })
      const data = await res.json()
      setImapTestResult({ ok: res.ok, message: data.message ?? data.error ?? 'Risposta sconosciuta' })
    } catch {
      setImapTestResult({ ok: false, message: 'Errore di rete.' })
    }
    setTestingImap(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-lg">
        <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center">
          <svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="font-semibold text-red-700">{t.sedi.accessDenied}</p>
          <p className="text-sm text-red-500 mt-1">{t.sedi.accessDeniedHint}</p>
        </div>
      </div>
    )
  }

  const inputCls = 'w-full rounded-lg border border-slate-600/50 bg-slate-900/95 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/35'

  const isSedeScopedAdmin = adminListScope === 'sede'

  return (
    <div className="w-full min-w-0 p-4 md:p-8 space-y-6 md:space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-100">{t.sedi.title}</h1>
          <p className="text-sm text-slate-400 mt-1 hidden md:block">{t.sedi.subtitle}</p>
          {isSedeScopedAdmin ? (
            <p className="mt-2 text-xs leading-snug text-amber-200/90 md:text-sm border border-amber-500/25 rounded-lg px-3 py-2 bg-amber-500/10">
              {t.sedi.adminScopedSediHint}
            </p>
          ) : null}
        </div>
        {!isSedeScopedAdmin ? (
          <button
            type="button"
            onClick={openWizard}
            className="flex items-center gap-2 px-3 py-2 md:px-4 md:py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">{t.sedi.newSede}</span>
            <span className="sm:hidden">Nuova</span>
          </button>
        ) : null}
      </div>

      {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      {successMsg && <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{successMsg}</div>}

      {/* ── Wizard nuova sede ── */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-slate-900/95 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">

            {/* Wizard header */}
            <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-100">Nuova sede</h2>
                <div className="flex items-center gap-1.5 mt-1.5">
                  {[1,2,3].map((s) => (
                    <div key={s} className={`h-1 rounded-full transition-all ${s <= wizardStep ? 'w-8 bg-cyan-500' : 'w-4 bg-slate-600'}`} />
                  ))}
                  <span className="text-xs text-slate-500 ml-1">Passo {wizardStep} di 3</span>
                </div>
              </div>
              <button onClick={() => setShowWizard(false)} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-5">

              {/* Step 1 — Nome sede + Geo-detection */}
              {wizardStep === 1 && (() => {
                const loc = getLocale(wizardCountryCode)
                return (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-200 mb-1">Nome della sede</p>
                      <p className="text-xs text-slate-500 mb-4">Es. &quot;Ristorante Roma&quot; o &quot;Magazzino Nord&quot;</p>
                      <input
                        type="text" autoFocus placeholder="Nome sede…"
                        value={wizardSedeName}
                        onChange={(e) => setWizardSedeName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && wizardSedeName.trim() && setWizardStep(2)}
                        className="w-full rounded-xl border border-slate-600/50 bg-slate-900/95 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/35"
                      />
                    </div>

                    {/* ── Geo-detection banner ── */}
                    <div className={`rounded-xl border px-4 py-3 text-xs transition-colors ${
                      wizardGeoStatus === 'detecting'
                        ? 'bg-slate-800/60 border-slate-600/50 text-slate-400'
                        : wizardGeoStatus === 'detected'
                        ? 'border-cyan-500/35 bg-cyan-500/10 text-cyan-100'
                        : 'border-amber-500/35 bg-amber-500/10 text-amber-100'
                    }`}>
                      {/* Status row */}
                      <div className="flex items-center gap-2 mb-2.5">
                        {wizardGeoStatus === 'detecting' ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                            </svg>
                            <span>Rilevamento posizione in corso…</span>
                          </>
                        ) : wizardGeoStatus === 'detected' ? (
                          <>
                            <span className="text-base leading-none">{loc.flag}</span>
                            <span className="font-semibold">Rilevata posizione: {loc.name}.</span>
                            <span className="text-blue-600">Termini fiscali impostati su <strong>{loc.vat}</strong> · <strong>{loc.vatLabel}</strong>.</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <span>Posizione non rilevata automaticamente. Termine predefinito: <strong>UK</strong>.</span>
                          </>
                        )}
                      </div>

                      {/* Manual override — always visible */}
                      <div className="flex items-center gap-2 pt-2 border-t border-current/10">
                        <span className="text-[11px] opacity-70 shrink-0">Cambia manualmente:</span>
                        <div className="relative">
                          <select
                            value={wizardCountryCode}
                            onChange={e => { setWizardCountryCode(e.target.value); setWizardGeoStatus('failed') }}
                            className="appearance-none pl-7 pr-6 py-1 text-xs border border-current/20 rounded-lg bg-slate-900/95/80 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 cursor-pointer"
                          >
                            {COUNTRY_OPTIONS.map(o => (
                              <option key={o.code} value={o.code}>{o.flag} {o.name}</option>
                            ))}
                          </select>
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm leading-none">
                            {loc.flag}
                          </span>
                          <svg className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => setWizardStep(2)}
                        disabled={!wizardSedeName.trim()}
                        className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
                      >
                        Avanti
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* Step 2 — Configurazione email IMAP */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-200 mb-1">Configurazione email</p>
                    <p className="text-xs text-slate-500 mb-4">Per ricevere fatture via email. Puoi configurarla anche dopo.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Server IMAP</label>
                      <input type="text" list="wizard-imap-providers" placeholder="imap.gmail.com"
                        value={wizardImap.imap_host}
                        onChange={(e) => {
                          const host = e.target.value
                          const portMap: Record<string, string> = {
                            'imap.gmail.com':'993','imap.googlemail.com':'993','outlook.office365.com':'993',
                            'imap-mail.outlook.com':'993','imap.mail.yahoo.com':'993','imap.apple.com':'993',
                            'imap.fastmail.com':'993','imap.libero.it':'993','imap.alice.it':'993',
                            'imap.tim.it':'993','imap.virgilio.it':'993','imap.aruba.it':'993',
                            'imapmail.aruba.it':'993','imap.tiscali.it':'993','imap.protonmail.ch':'993','imap.zoho.com':'993',
                          }
                          setWizardImap({ ...wizardImap, imap_host: host, imap_port: portMap[host] ?? wizardImap.imap_port })
                        }}
                        className="w-full px-3 py-2 text-sm border border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/35 focus:border-cyan-500 bg-slate-900/95"
                      />
                      <datalist id="wizard-imap-providers">
                        <option value="imap.gmail.com">Gmail</option>
                        <option value="imap.googlemail.com">Gmail (alt.)</option>
                        <option value="outlook.office365.com">Outlook / M365</option>
                        <option value="imap-mail.outlook.com">Outlook.com</option>
                        <option value="imap.mail.yahoo.com">Yahoo</option>
                        <option value="imap.apple.com">iCloud</option>
                        <option value="imap.fastmail.com">Fastmail</option>
                        <option value="imap.protonmail.ch">Proton</option>
                        <option value="imap.zoho.com">Zoho</option>
                        <option value="imap.libero.it">Libero</option>
                        <option value="imap.alice.it">Alice/TIM</option>
                        <option value="imap.virgilio.it">Virgilio</option>
                        <option value="imap.aruba.it">Aruba</option>
                        <option value="imapmail.aruba.it">Aruba PEC</option>
                        <option value="imap.tiscali.it">Tiscali</option>
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Porta</label>
                      <input type="number" placeholder="993" value={wizardImap.imap_port}
                        onChange={(e) => setWizardImap({ ...wizardImap, imap_port: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/35 focus:border-cyan-500 bg-slate-900/95"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Email account</label>
                      <input type="email" placeholder="email@esempio.it" value={wizardImap.imap_user}
                        onChange={(e) => setWizardImap({ ...wizardImap, imap_user: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/35 focus:border-cyan-500 bg-slate-900/95"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Password / App Password</label>
                      <div className="relative">
                        <input type={wizardShowImap ? 'text' : 'password'} placeholder="Password…" value={wizardImap.imap_password}
                          onChange={(e) => setWizardImap({ ...wizardImap, imap_password: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/35 focus:border-cyan-500 bg-slate-900/95 pr-9"
                        />
                        <button type="button" onClick={() => setWizardShowImap(!wizardShowImap)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {wizardShowImap
                              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                              : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></>
                            }
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                  {(wizardImap.imap_host.includes('gmail') || wizardImap.imap_host.includes('outlook') || wizardImap.imap_host.includes('office365')) && (
                    <div className="flex gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
                      <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                      </svg>
                      <span>
                        {wizardImap.imap_host.includes('gmail')
                          ? <><strong>App Password richiesta.</strong> <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline transition-colors hover:text-cyan-300">Genera su Google →</a></>
                          : <><strong>App Password richiesta.</strong> <a href="https://account.microsoft.com/security" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline transition-colors hover:text-cyan-300">Genera su Microsoft →</a></>
                        }
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <button onClick={() => setWizardStep(1)} className="px-4 py-2 text-sm text-slate-400 border border-slate-600/50 rounded-xl hover:bg-slate-800/60">
                      ← Indietro
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => { setWizardImap({ imap_host:'', imap_port:'993', imap_user:'', imap_password:'', imap_lookback_days: '30' }); setWizardStep(3) }}
                        className="px-4 py-2 text-sm text-slate-500 hover:text-slate-300 rounded-xl hover:bg-slate-800/60">
                        Salta
                      </button>
                      <button onClick={() => setWizardStep(3)}
                        className="px-5 py-2 bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2">
                        Avanti
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3 — Operatori */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-200 mb-1">Aggiungi operatori</p>
                    <p className="text-xs text-slate-500 mb-4">Gli operatori accedono con nome + PIN. Puoi aggiungerne altri dopo.</p>
                  </div>

                  {/* Lista operatori aggiunti */}
                  {wizardOperators.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {wizardOperators.map((op, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-100 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                              <span className="text-white text-[10px] font-bold">{op.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="text-sm font-medium text-slate-100">{op.name}</span>
                            <span className="text-xs text-slate-500">PIN: {'•'.repeat(op.pin.length)}</span>
                          </div>
                          <button onClick={() => setWizardOperators(wizardOperators.filter((_, j) => j !== i))}
                            className="text-slate-600 hover:text-red-400 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Form nuovo operatore */}
                  <div className="bg-slate-800/60 border border-slate-600/50 rounded-xl p-3 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Nome operatore</label>
                        <input type="text" placeholder="Mario Rossi" value={wizardNewOpName}
                          onChange={(e) => setWizardNewOpName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addWizardOperator()}
                          className="w-full px-3 py-2 text-sm border border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/35 focus:border-cyan-500 bg-slate-900/95"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">PIN (min. 4 cifre)</label>
                        <div className="relative">
                          <input
                            type={wizardShowPin ? 'text' : 'password'}
                            placeholder="es. 1234"
                            value={wizardNewOpPin}
                            onChange={(e) => setWizardNewOpPin(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addWizardOperator()}
                            className="w-full px-3 py-2 text-sm border border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/35 focus:border-cyan-500 bg-slate-900/95 pr-9"
                          />
                          <button type="button" onClick={() => setWizardShowPin(!wizardShowPin)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {wizardShowPin
                                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                                : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></>
                              }
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                    <button type="button" onClick={addWizardOperator}
                      disabled={!wizardNewOpName.trim() || String(wizardNewOpPin).length < 4}
                      className="w-full py-2 text-sm font-medium border-2 border-dashed border-slate-600/50 hover:border-cyan-500 hover:text-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-500 rounded-lg transition-colors flex items-center justify-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
                      </svg>
                      Aggiungi operatore
                    </button>
                  </div>

                  {wizardError && (
                    <div className="text-xs px-3 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg">{wizardError}</div>
                  )}

                  <div className="flex justify-between pt-1">
                    <button onClick={() => setWizardStep(2)} className="px-4 py-2 text-sm text-slate-400 border border-slate-600/50 rounded-xl hover:bg-slate-800/60">
                      ← Indietro
                    </button>
                    <button onClick={handleWizardCreate} disabled={creatingWizard}
                      className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2">
                      {creatingWizard ? (
                        <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Creazione…</>
                      ) : (
                        <>Crea sede{wizardOperators.length > 0 ? ` + ${wizardOperators.length} operatore${wizardOperators.length > 1 ? 'i' : ''}` : ''}</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sedi list */}
      <div>
        <h2 className="text-base font-semibold text-slate-100 mb-3">{t.sedi.title} ({sedi.length})</h2>
        {sedi.length === 0 ? (
          <div className="bg-slate-800/60 border border-dashed border-slate-600/50 rounded-xl p-8 text-center">
            <p className="text-slate-500 text-sm">{t.sedi.noSedi}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sedi.map((sede) => (
              <div key={sede.id} className="bg-slate-900/95 border border-slate-700/50 rounded-xl shadow-sm overflow-hidden">

                {/* ── Header sede ── */}
                <div className="flex items-center justify-between px-5 py-4">
                  {editingSede?.id === sede.id ? (
                    <form onSubmit={handleUpdateSede} className="flex gap-2 flex-1 mr-2">
                      <input
                        type="text" required autoFocus value={editingSede.nome}
                        onChange={(e) => setEditingSede({ ...editingSede, nome: e.target.value })}
                        className="flex-1 px-3 py-1.5 text-sm border border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/35 focus:border-cyan-500"
                      />
                      <button type="submit" className="px-3 py-1.5 text-xs bg-cyan-500 text-white rounded-lg hover:bg-cyan-600">{t.common.save}</button>
                      <button type="button" onClick={() => setEditingSede(null)} className="px-3 py-1.5 text-xs border border-slate-600/50 rounded-lg hover:bg-slate-800/60 text-slate-400">✕</button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 bg-cyan-500 rounded-lg flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-100 leading-tight">{sede.nome}</h3>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-slate-500">{sede.users_count} operatori · {sede.fornitori_count} fornitori · {sede.bolle_count} bolle · {sede.fatture_count} fatture</span>
                            {sede.access_password && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold rounded">PIN</span>
                            )}
                            {sede.imap_user ? (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded">EMAIL ✓</span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-slate-800/80 text-slate-500 text-[10px] font-medium rounded">Email non config.</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setEditingSede({ id: sede.id, nome: sede.nome })}
                          className="p-1.5 text-slate-600 hover:text-slate-300 hover:bg-slate-800/80 rounded-lg transition-colors" title={t.sedi.renameTitle}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {!isSedeScopedAdmin ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteSede(sede.id, sede.nome)}
                            className="p-1.5 text-slate-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title={t.sedi.deleteTitle}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>

                {/* ── Utenti della sede ── */}
                {(() => {
                  const sedeProfiles = profiles.filter(p => p.sede_id === sede.id)
                  if (sedeProfiles.length === 0) return null
                  return (
                    <div className="border-t border-slate-700/50 px-5 py-3">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        Operatori ({sedeProfiles.length})
                      </p>
                      <div className="space-y-1">
                        {sedeProfiles.map((p) => (
                          <div key={p.id}>
                            {editingProfile?.id === p.id ? (
                              <form
                                className="px-3 py-2.5 bg-blue-50/60 rounded-lg border border-blue-100 space-y-3"
                                onSubmit={(e) => {
                                  e.preventDefault()
                                  void handleSaveProfile()
                                }}
                              >
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <div className="min-w-0">
                                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Nome</label>
                                    <input
                                      type="text"
                                      autoFocus
                                      value={editingProfile.full_name}
                                      onChange={(e) => setEditingProfile({ ...editingProfile, full_name: e.target.value })}
                                      className="w-full text-sm px-2.5 py-2 min-h-[44px] border border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/35 focus:border-cyan-500 bg-slate-900/95"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">Ruolo</label>
                                    <select
                                      value={editingProfile.role}
                                      onChange={(e) => setEditingProfile({ ...editingProfile, role: e.target.value })}
                                      className="w-full text-sm px-2.5 py-2 min-h-[44px] border border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/35 focus:border-cyan-500 bg-slate-900/95"
                                    >
                                      <option value="operatore">Operatore</option>
                                      <option value="admin_sede">Admin sede</option>
                                      <option value="admin">Admin</option>
                                    </select>
                                  </div>
                                </div>
                                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setEditingProfile(null)}
                                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-sm border border-slate-600/50 rounded-lg hover:bg-slate-800/80 text-slate-400"
                                  >
                                    {t.common.cancel}
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={savingProfile}
                                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 text-sm font-semibold bg-cyan-500 text-white rounded-lg shadow-sm hover:bg-cyan-600 active:bg-cyan-700 disabled:opacity-50 touch-manipulation"
                                  >
                                    {savingProfile ? 'Salvo…' : t.common.save}
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <div className="flex items-center justify-between py-1.5 px-3 bg-slate-800/60 rounded-lg">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-6 h-6 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
                                    <svg className="w-3 h-3 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                  </div>
                                  <p className="text-xs font-semibold text-slate-200 truncate">
                                    {p.full_name ?? p.email ?? '—'}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                    p.role === 'admin'
                                      ? 'bg-violet-100 text-violet-700'
                                      : p.role === 'admin_sede'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-blue-50 text-blue-600'
                                  }`}>
                                    {p.role === 'admin' ? 'Admin' : p.role === 'admin_sede' ? 'Ad. sede' : 'Op.'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setEditingProfile({ id: p.id, full_name: p.full_name ?? '', role: p.role })}
                                    className="p-1 text-slate-600 hover:text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors"
                                    title="Modifica"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(p.id, p.email ?? '')}
                                    disabled={deletingUserId === p.id}
                                    className="p-1 text-slate-600 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-40"
                                    title="Elimina"
                                  >
                                    {deletingUserId === p.id
                                      ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                      : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    }
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* ── Azioni (3 accordion) ── */}
                <div className="border-t border-slate-700/50 divide-y divide-slate-700/50">

                  {/* Crea operatore */}
                  <button type="button"
                    onClick={() => { setCreateUserOpen(createUserOpen === sede.id ? null : sede.id); setCreateUserMsg(null); setNewUserEmail(''); setNewUserPassword(''); setNewUserName('') }}
                    className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-slate-400 hover:bg-slate-800/60 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
                      </svg>
                      Aggiungi operatore
                    </span>
                    <svg className={`w-3.5 h-3.5 transition-transform ${createUserOpen === sede.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  {createUserOpen === sede.id && (
                    <div className="px-5 py-4 space-y-3 bg-slate-800/40">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Nome operatore</label>
                          <input type="text" placeholder="Mario Rossi" value={newUserName}
                            onChange={(e) => setNewUserName(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/35 focus:border-cyan-500 bg-slate-900/95" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">PIN (min. 4 caratteri)</label>
                          <div className="relative">
                            <input type={showNewUserPw ? 'text' : 'password'} placeholder="es. 1234" value={newUserPassword}
                              onChange={(e) => setNewUserPassword(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/35 focus:border-cyan-500 bg-slate-900/95 pr-9" />
                            <button type="button" onClick={() => setShowNewUserPw(!showNewUserPw)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {showNewUserPw
                                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                                  : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></>
                                }
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                      {createUserMsg && (
                        <div className={`text-xs px-3 py-2 rounded-lg ${createUserMsg.ok ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                          {createUserMsg.text}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setCreateUserOpen(null)}
                          className="px-3 py-2 text-sm border border-slate-600/50 rounded-lg hover:bg-slate-800/60 text-slate-400">Annulla</button>
                        <button type="button" onClick={() => handleCreateUser(sede.id)}
                          disabled={creatingUser || !newUserName.trim() || newUserPassword.length < 4}
                          className="flex-1 py-2 text-sm font-medium bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white rounded-lg transition-colors">
                          {creatingUser ? 'Creazione…' : 'Crea operatore'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Codice accesso */}
                  <button type="button"
                    onClick={() => { if (accessPwOpen === sede.id) { setAccessPwOpen(null) } else { setAccessPwOpen(sede.id); setAccessPwValue(sede.access_password ?? ''); setShowAccessPw(false) } }}
                    className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-slate-400 hover:bg-slate-800/60 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                      </svg>
                      Codice accesso sede
                    </span>
                    <svg className={`w-3.5 h-3.5 transition-transform ${accessPwOpen === sede.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  {accessPwOpen === sede.id && (
                    <div className="px-5 py-4 space-y-3 bg-slate-800/40">
                      <div className="relative">
                        <input type={showAccessPw ? 'text' : 'password'} placeholder="PIN o password sede…" value={accessPwValue}
                          onChange={(e) => setAccessPwValue(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-600/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/35 focus:border-cyan-500 bg-slate-900/95 pr-9" />
                        <button type="button" onClick={() => setShowAccessPw(!showAccessPw)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {showAccessPw
                              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                              : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></>
                            }
                          </svg>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500">Lascia vuoto per disabilitare il codice.</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setAccessPwOpen(null)}
                          className="px-3 py-2 text-sm border border-slate-600/50 rounded-lg hover:bg-slate-800/60 text-slate-400">Annulla</button>
                        <button type="button" onClick={() => handleSaveAccessPassword(sede.id)} disabled={savingAccessPw}
                          className="flex-1 py-2 text-sm font-medium bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white rounded-lg transition-colors">
                          {savingAccessPw ? 'Salvataggio…' : 'Salva'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Localizzazione (currency + timezone) ── */}
                  <button type="button"
                    onClick={() => { if (locOpen === sede.id) { setLocOpen(null) } else { openLocForm(sede) } }}
                    className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-slate-400 hover:bg-slate-800/60 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"/>
                      </svg>
                      Valuta &amp; Fuso orario
                    </span>
                    <svg className={`w-3.5 h-3.5 transition-transform ${locOpen === sede.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  {locOpen === sede.id && (
                    <div className="px-5 py-4 space-y-3 bg-slate-800/40">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Valuta (ISO 4217)</label>
                          <select value={locCurrency} onChange={(e) => setLocCurrency(e.target.value)} className={inputCls}>
                            {CURRENCIES.map((c) => (
                              <option key={c.code} value={c.code}>{c.symbol} {c.label} ({c.code})</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">Fuso orario</label>
                          <select value={locTimezone} onChange={(e) => setLocTimezone(e.target.value)} className={inputCls}>
                            {TIMEZONES.map((tz) => (
                              <option key={tz.value} value={tz.value}>{tz.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setLocOpen(null)}
                          className="px-3 py-2 text-sm border border-slate-600/50 rounded-lg hover:bg-slate-800/60 text-slate-400">{t.common.cancel}</button>
                        <button type="button" onClick={() => handleSaveLoc(sede.id)} disabled={savingLoc}
                          className="flex-1 py-2 text-sm font-medium bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white rounded-lg transition-colors">
                          {savingLoc ? t.common.loading : t.common.save}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* IMAP email */}
                  <button type="button"
                    onClick={() => { if (imapOpen === sede.id) { setImapOpen(null) } else { openImapForm(sede) } }}
                    className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-slate-400 hover:bg-slate-800/60 transition-colors"
                  >
                    <span className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                      </svg>
                      {t.sedi.imap}
                    </span>
                    <svg className={`w-3.5 h-3.5 transition-transform ${imapOpen === sede.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  {imapOpen === sede.id && (
                    <div className="px-5 py-4 space-y-3 bg-slate-800/40">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-slate-400 mb-1">{t.sedi.imapHost}</label>
                          <input type="text" list="imap-providers" placeholder={t.sedi.imapHostPlaceholder}
                            value={imapForm.imap_host}
                            onChange={(e) => {
                              const host = e.target.value
                              const portMap: Record<string, string> = {
                                'imap.gmail.com': '993', 'imap.googlemail.com': '993',
                                'outlook.office365.com': '993', 'imap-mail.outlook.com': '993',
                                'imap.mail.yahoo.com': '993', 'imap.apple.com': '993',
                                'imap.fastmail.com': '993', 'imap.libero.it': '993',
                                'imap.alice.it': '993', 'imap.tim.it': '993',
                                'imap.virgilio.it': '993', 'imap.aruba.it': '993',
                                'imapmail.aruba.it': '993', 'imap.tiscali.it': '993',
                                'imap.pec.it': '993', 'mail.registro.it': '993',
                                'imap.protonmail.ch': '993', 'imap.zoho.com': '993',
                              }
                              setImapForm({ ...imapForm, imap_host: host, imap_port: portMap[host] ?? imapForm.imap_port })
                            }}
                            className={inputCls} />
                          <datalist id="imap-providers">
                            <option value="imap.gmail.com">Gmail</option>
                            <option value="imap.googlemail.com">Gmail (alt.)</option>
                            <option value="outlook.office365.com">Outlook / M365</option>
                            <option value="imap-mail.outlook.com">Outlook.com</option>
                            <option value="imap.mail.yahoo.com">Yahoo</option>
                            <option value="imap.apple.com">iCloud</option>
                            <option value="imap.fastmail.com">Fastmail</option>
                            <option value="imap.protonmail.ch">Proton</option>
                            <option value="imap.zoho.com">Zoho</option>
                            <option value="imap.libero.it">Libero</option>
                            <option value="imap.alice.it">Alice/TIM</option>
                            <option value="imap.tim.it">TIM</option>
                            <option value="imap.virgilio.it">Virgilio</option>
                            <option value="imap.aruba.it">Aruba</option>
                            <option value="imapmail.aruba.it">Aruba PEC</option>
                            <option value="imap.tiscali.it">Tiscali</option>
                            <option value="mail.registro.it">Registro.it</option>
                          </datalist>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">{t.sedi.imapPort}</label>
                          <input type="number" placeholder="993" value={imapForm.imap_port}
                            onChange={(e) => setImapForm({ ...imapForm, imap_port: e.target.value })}
                            className={inputCls} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">{t.sedi.imapUser}</label>
                          <input type="email" placeholder="email@esempio.it" value={imapForm.imap_user}
                            onChange={(e) => setImapForm({ ...imapForm, imap_user: e.target.value })}
                            className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1">{t.sedi.imapPassword}</label>
                          <div className="relative">
                            <input type={showPassword ? 'text' : 'password'} placeholder={t.sedi.imapPasswordPlaceholder}
                              value={imapForm.imap_password}
                              onChange={(e) => setImapForm({ ...imapForm, imap_password: e.target.value })}
                              className={`${inputCls} pr-9`} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {showPassword
                                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/>
                                  : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></>
                                }
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                      {/* Lookback days */}
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">
                          Giorni di lookback email
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="365"
                            placeholder="30"
                            value={imapForm.imap_lookback_days}
                            onChange={(e) => setImapForm({ ...imapForm, imap_lookback_days: e.target.value })}
                            className={`${inputCls} w-28`}
                          />
                          <span className="text-xs text-slate-500">
                            {imapForm.imap_lookback_days && parseInt(imapForm.imap_lookback_days) > 0
                              ? `Legge email non lette degli ultimi ${imapForm.imap_lookback_days} giorni`
                              : 'Legge tutte le email non lette (nessun limite)'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">Lascia vuoto per nessun limite. Consigliato: 30–90 giorni.</p>
                      </div>

                      {(imapForm.imap_host.includes('gmail') || imapForm.imap_host.includes('googlemail') || imapForm.imap_host.includes('outlook') || imapForm.imap_host.includes('office365')) && (
                        <div className="flex gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
                          <svg className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          </svg>
                          <span>
                            {imapForm.imap_host.includes('gmail') || imapForm.imap_host.includes('googlemail')
                              ? <><strong>App Password richiesta.</strong> <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline transition-colors hover:text-cyan-300">Genera su Google →</a></>
                              : <><strong>App Password richiesta.</strong> <a href="https://account.microsoft.com/security" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline transition-colors hover:text-cyan-300">Genera su Microsoft →</a></>
                            }
                          </span>
                        </div>
                      )}
                      {imapTestResult && (
                        <div className={`text-xs px-3 py-2 rounded-lg ${imapTestResult.ok ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                          {imapTestResult.message}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleTestImap(sede.id)}
                          disabled={testingImap || !imapForm.imap_host || !imapForm.imap_user || !imapForm.imap_password}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-600/50 rounded-lg hover:bg-slate-800/60 disabled:opacity-50 text-slate-400">
                          {testingImap ? <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                            : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                          {t.sedi.testConnection}
                        </button>
                        <button type="button" onClick={() => setImapOpen(null)}
                          className="px-3 py-2 text-sm border border-slate-600/50 rounded-lg hover:bg-slate-800/60 text-slate-400">{t.common.cancel}</button>
                        <button type="button" onClick={() => handleSaveImap(sede.id)} disabled={savingImap}
                          className="flex-1 py-2 text-sm font-medium bg-cyan-500 hover:bg-cyan-600 disabled:opacity-60 text-white rounded-lg transition-colors">
                          {savingImap ? t.common.loading : t.sedi.saveConfig}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Utenti senza sede — solo amministratore principale (admin senza sede sul profilo) */}
      {adminListScope === 'global'
        ? (() => {
        const unassigned = profiles.filter(p => !p.sede_id)
        if (unassigned.length === 0) return null
        return (
          <div>
            <h2 className="text-sm font-semibold text-slate-400 mb-3">Utenti senza sede ({unassigned.length})</h2>
            <div className="bg-slate-900/95 border border-slate-700/50 rounded-xl shadow-sm divide-y divide-slate-800/60">
              {unassigned.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    {p.full_name && <p className="text-sm font-semibold text-slate-100">{p.full_name}</p>}
                    <p className="text-sm text-slate-500">{p.email ?? '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        p.role === 'admin'
                          ? 'bg-violet-100 text-violet-700'
                          : p.role === 'admin_sede'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-50 text-blue-600'
                      }`}
                    >
                      {p.role === 'admin' ? 'Admin' : p.role === 'admin_sede' ? 'Ad. sede' : 'Op.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(p.id, p.email ?? '')}
                      disabled={deletingUserId === p.id}
                      className="p-1.5 text-slate-600 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()
        : null}

    </div>
  )
}
