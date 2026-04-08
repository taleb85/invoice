'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import type { Sede, Profile } from '@/types'
import { useT } from '@/lib/use-t'

interface SedeWithCounts extends Sede {
  fornitori_count: number
  bolle_count: number
  fatture_count: number
  users_count: number
  imap_host: string | null
  imap_port: number | null
  imap_user: string | null
  imap_password: string | null
}

interface ProfileWithSede extends Profile {
  sedi: Sede | null
}

interface ImapForm {
  imap_host: string
  imap_port: string
  imap_user: string
  imap_password: string
}

export default function SediPage() {
  const router = useRouter()
  const supabase = createClient()
  const t = useT()

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [sedi, setSedi] = useState<SedeWithCounts[]>([])
  const [profiles, setProfiles] = useState<ProfileWithSede[]>([])
  const [allSedi, setAllSedi] = useState<Sede[]>([])
  const [loading, setLoading] = useState(true)

  // New sede form
  const [newSedeName, setNewSedeName] = useState('')
  const [addingSede, setAddingSede] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  // Edit sede name
  const [editingSede, setEditingSede] = useState<{ id: string; nome: string } | null>(null)

  // IMAP config per sede
  const [imapOpen, setImapOpen] = useState<string | null>(null)
  const [imapForm, setImapForm] = useState<ImapForm>({ imap_host: '', imap_port: '993', imap_user: '', imap_password: '' })
  const [savingImap, setSavingImap] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [testingImap, setTestingImap] = useState(false)
  const [imapTestResult, setImapTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const loadData = async () => {
    const supabaseClient = createClient()
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      setIsAdmin(false)
      setLoading(false)
      return
    }
    setIsAdmin(true)

    const { data: sediData } = await supabaseClient
      .from('sedi')
      .select('*')
      .order('nome')

    const sediWithCounts: SedeWithCounts[] = await Promise.all(
      (sediData ?? []).map(async (sede: Sede & { imap_host?: string; imap_port?: number; imap_user?: string; imap_password?: string }) => {
        const [{ count: fornitori_count }, { count: bolle_count }, { count: fatture_count }, { count: users_count }] =
          await Promise.all([
            supabaseClient.from('fornitori').select('*', { count: 'exact', head: true }).eq('sede_id', sede.id),
            supabaseClient.from('bolle').select('*', { count: 'exact', head: true }).eq('sede_id', sede.id),
            supabaseClient.from('fatture').select('*', { count: 'exact', head: true }).eq('sede_id', sede.id),
            supabaseClient.from('profiles').select('*', { count: 'exact', head: true }).eq('sede_id', sede.id),
          ])
        return {
          ...sede,
          fornitori_count: fornitori_count ?? 0,
          bolle_count: bolle_count ?? 0,
          fatture_count: fatture_count ?? 0,
          users_count: users_count ?? 0,
          imap_host: sede.imap_host ?? null,
          imap_port: sede.imap_port ?? null,
          imap_user: sede.imap_user ?? null,
          imap_password: sede.imap_password ?? null,
        }
      })
    )
    setSedi(sediWithCounts)
    setAllSedi(sediData ?? [])

    const { data: profilesData } = await supabaseClient
      .from('profiles')
      .select('*, sedi(id, nome, created_at)')
      .order('email')

    setProfiles((profilesData as ProfileWithSede[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddSede = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSedeName.trim()) return
    setAddingSede(true)
    setError(null)

    const { error: err } = await supabase.from('sedi').insert([{ nome: newSedeName.trim() }])
    setAddingSede(false)
    if (err) { setError(err.message); return }
    setNewSedeName('')
    setShowAddForm(false)
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
    })
  }

  const handleSaveImap = async (sedeId: string) => {
    setSavingImap(true)
    setError(null)
    const { error: err } = await supabase.from('sedi').update({
      imap_host: imapForm.imap_host.trim() || null,
      imap_port: parseInt(imapForm.imap_port) || 993,
      imap_user: imapForm.imap_user.trim() || null,
      imap_password: imapForm.imap_password || null,
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
        <div className="w-8 h-8 border-2 border-[#1a3050] border-t-transparent rounded-full animate-spin" />
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

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3050] bg-white'

  return (
    <div className="p-8 max-w-5xl space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t.sedi.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{t.sedi.subtitle}</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1a3050] hover:bg-[#122238] text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t.sedi.newSede}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg">{error}</div>}
      {successMsg && <div className="bg-green-50 border border-green-100 text-green-700 text-sm px-4 py-3 rounded-lg">{successMsg}</div>}

      {/* Add sede form */}
      {showAddForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 mb-3">{t.sedi.newSede}</h3>
          <form onSubmit={handleAddSede} className="flex gap-3">
            <input
              type="text" autoFocus required placeholder={t.sedi.nomePlaceholder}
              value={newSedeName} onChange={(e) => setNewSedeName(e.target.value)}
              className="flex-1 px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3050]"
            />
            <button type="submit" disabled={addingSede} className="px-4 py-2.5 bg-[#1a3050] text-white text-sm font-medium rounded-lg hover:bg-[#122238] disabled:opacity-60">
              {addingSede ? t.sedi.creatingBtn : t.sedi.createBtn}
            </button>
            <button type="button" onClick={() => { setShowAddForm(false); setNewSedeName('') }} className="px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
              {t.common.cancel}
            </button>
          </form>
        </div>
      )}

      {/* Sedi list */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">{t.sedi.title} ({sedi.length})</h2>
        {sedi.length === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-200 rounded-xl p-8 text-center">
            <p className="text-gray-400 text-sm">{t.sedi.noSedi}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sedi.map((sede) => (
              <div key={sede.id} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">

                {/* Sede header */}
                <div className="p-5">
                  {editingSede?.id === sede.id ? (
                    <form onSubmit={handleUpdateSede} className="flex gap-2 mb-4">
                      <input
                        type="text" required autoFocus value={editingSede.nome}
                        onChange={(e) => setEditingSede({ ...editingSede, nome: e.target.value })}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3050]"
                      />
                      <button type="submit" className="px-3 py-2 text-xs bg-[#1a3050] text-white rounded-lg hover:bg-[#122238]">{t.common.save}</button>
                      <button type="button" onClick={() => setEditingSede(null)} className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">✕</button>
                    </form>
                  ) : (
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[#1a3050] rounded-lg flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{sede.nome}</h3>
                          {sede.imap_user ? (
                            <p className="text-xs text-green-600 flex items-center gap-1 mt-0.5">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                              </svg>
                              {sede.imap_user}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-400 mt-0.5">{t.sedi.notConfigured}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setEditingSede({ id: sede.id, nome: sede.nome })}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title={t.sedi.renameTitle}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteSede(sede.id, sede.nome)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={t.sedi.deleteTitle}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[
                      { label: t.sedi.users, value: sede.users_count },
                      { label: t.fornitori.title, value: sede.fornitori_count },
                      { label: t.bolle.title, value: sede.bolle_count },
                      { label: t.fatture.title, value: sede.fatture_count },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-gray-50 rounded-lg py-2">
                        <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                        <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* IMAP config toggle */}
                <div className="border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => {
                      if (imapOpen === sede.id) {
                        setImapOpen(null)
                      } else {
                        openImapForm(sede)
                      }
                    }}
                    className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                      </svg>
                      {t.sedi.imap}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${imapOpen === sede.id ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>

                  {imapOpen === sede.id && (
                    <div className="px-5 pb-5 space-y-4 bg-gray-50/50 border-t border-gray-100">
                      <p className="text-xs text-gray-500 pt-4">
                        {t.sedi.imapSubtitle}
                      </p>

                      <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">{t.sedi.imapHost}</label>
                          <input
                            type="text" placeholder={t.sedi.imapHostPlaceholder}
                            value={imapForm.imap_host}
                            onChange={(e) => setImapForm({ ...imapForm, imap_host: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">{t.sedi.imapPort}</label>
                          <input
                            type="number" placeholder="993"
                            value={imapForm.imap_port}
                            onChange={(e) => setImapForm({ ...imapForm, imap_port: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{t.sedi.imapUser}</label>
                        <input
                          type="email" placeholder={t.sedi.imapUser}
                          value={imapForm.imap_user}
                          onChange={(e) => setImapForm({ ...imapForm, imap_user: e.target.value })}
                          className={inputCls}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{t.sedi.imapPassword}</label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder={t.sedi.imapPasswordPlaceholder}
                            value={imapForm.imap_password}
                            onChange={(e) => setImapForm({ ...imapForm, imap_password: e.target.value })}
                            className={`${inputCls} pr-10`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Test result */}
                      {imapTestResult && (
                        <div className={`flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg ${
                          imapTestResult.ok
                            ? 'bg-green-50 text-green-700 border border-green-100'
                            : 'bg-red-50 text-red-600 border border-red-100'
                        }`}>
                          {imapTestResult.ok
                            ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                            : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                          }
                          {imapTestResult.message}
                        </div>
                      )}

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleTestImap(sede.id)}
                          disabled={testingImap || !imapForm.imap_host || !imapForm.imap_user || !imapForm.imap_password}
                          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-gray-600 transition-colors"
                        >
                          {testingImap ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                          )}
                          {t.sedi.testConnection}
                        </button>
                        <button
                          type="button"
                          onClick={() => setImapOpen(null)}
                          className="px-3 py-2 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          {t.common.cancel}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveImap(sede.id)}
                          disabled={savingImap}
                          className="flex-1 px-3 py-2 text-sm font-medium bg-[#1a3050] hover:bg-[#122238] disabled:opacity-60 text-white rounded-lg transition-colors"
                        >
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

      {/* Users list */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">{t.sedi.users} ({profiles.length})</h2>
        <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
          {profiles.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">{t.sedi.nessunUtente}</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">{t.sedi.emailHeader}</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">{t.sedi.sedeHeader}</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3">{t.sedi.ruoloHeader}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-sm font-medium text-gray-800">{p.email ?? <span className="text-gray-400 italic">—</span>}</p>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={p.sede_id ?? ''}
                        onChange={(e) => handleUpdateProfile(p.id, 'sede_id', e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1a3050] bg-white"
                      >
                        <option value="">{t.sedi.nessunaSedeOption}</option>
                        {allSedi.map((s) => (
                          <option key={s.id} value={s.id}>{s.nome}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={p.role}
                        onChange={(e) => handleUpdateProfile(p.id, 'role', e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1a3050] bg-white"
                      >
                        <option value="operatore">{t.sedi.operatoreRole}</option>
                        <option value="admin">{t.sedi.adminRole}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  )
}
