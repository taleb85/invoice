'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useT } from '@/lib/use-t'

interface AliasEmail {
  id: string
  email: string
  label: string | null
}

export default function EditFornitore() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const t = useT()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ nome: '', email: '', piva: '' })

  // Alias email
  const [aliases, setAliases] = useState<AliasEmail[]>([])
  const [newAlias, setNewAlias] = useState({ email: '', label: '' })
  const [addingAlias, setAddingAlias] = useState(false)
  const [deletingAliasId, setDeletingAliasId] = useState<string | null>(null)

  async function loadAliases() {
    const { data } = await supabase
      .from('fornitore_emails')
      .select('id, email, label')
      .eq('fornitore_id', id)
      .order('created_at')
    setAliases(data ?? [])
  }

  useEffect(() => {
    async function load() {
      const [{ data, error }] = await Promise.all([
        supabase.from('fornitori').select('*').eq('id', id).single(),
        loadAliases(),
      ])

      if (error || !data) {
        setError(t.fornitori.notFound)
      } else {
        setForm({ nome: data.nome ?? '', email: data.email ?? '', piva: data.piva ?? '' })
      }
      setLoading(false)
    }
    load()
  }, [id])

  const handleAddAlias = async () => {
    if (!newAlias.email.trim()) return
    setAddingAlias(true)
    const { error: err } = await supabase.from('fornitore_emails').insert([{
      fornitore_id: id,
      email: newAlias.email.trim().toLowerCase(),
      label: newAlias.label.trim() || null,
    }])
    setAddingAlias(false)
    if (err) { setError(err.message); return }
    setNewAlias({ email: '', label: '' })
    await loadAliases()
  }

  const handleDeleteAlias = async (aliasId: string) => {
    setDeletingAliasId(aliasId)
    await supabase.from('fornitore_emails').delete().eq('id', aliasId)
    setDeletingAliasId(null)
    await loadAliases()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const { error: err } = await supabase
      .from('fornitori')
      .update({ nome: form.nome, email: form.email || null, piva: form.piva || null })
      .eq('id', id)

    setSaving(false)
    if (err) { setError(err.message); return }
    router.push('/fornitori')
    router.refresh()
  }

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3050] focus:border-transparent bg-white'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  if (loading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-[#1a3050] border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-lg">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t.fornitori.editTitle}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
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

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 text-sm font-medium bg-[#1a3050] hover:bg-[#122238] disabled:opacity-60 text-white rounded-lg transition-colors"
          >
            {saving ? t.fornitori.saving : t.fornitori.saveChanges}
          </button>
        </div>
      </form>

      {/* ── Email alias ── */}
      <div className="mt-6 bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Email riconosciute</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Indirizzi aggiuntivi da cui questo fornitore può inviare documenti. La scansione email li abbina automaticamente.
          </p>
        </div>

        {/* Lista alias */}
        {aliases.length > 0 && (
          <div className="space-y-1.5">
            {aliases.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{a.email}</p>
                  {a.label && <p className="text-xs text-gray-400">{a.label}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteAlias(a.id)}
                  disabled={deletingAliasId === a.id}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 shrink-0"
                >
                  {deletingAliasId === a.id
                    ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                    : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                  }
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Aggiungi alias */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="email"
              placeholder="es. fatture@fornitore.it"
              value={newAlias.email}
              onChange={(e) => setNewAlias({ ...newAlias, email: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAlias())}
              className={inputCls}
            />
            <input
              type="text"
              placeholder="Etichetta (opz.)"
              value={newAlias.label}
              onChange={(e) => setNewAlias({ ...newAlias, label: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAlias())}
              className={inputCls}
            />
          </div>
          <button
            type="button"
            onClick={handleAddAlias}
            disabled={addingAlias || !newAlias.email.trim()}
            className="w-full py-2 text-sm font-medium border border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-[#1a3050] hover:text-[#1a3050] transition-colors disabled:opacity-40"
          >
            {addingAlias ? 'Aggiunta…' : '+ Aggiungi email'}
          </button>
        </div>
      </div>
    </div>
  )
}
