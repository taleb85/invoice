'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useSedeId } from '@/lib/use-sede'
import { useT } from '@/lib/use-t'

export default function NewFornitore() {
  const router = useRouter()
  const supabase = createClient()
  const { sedeId } = useSedeId()
  const t = useT()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ nome: '', email: '', piva: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const { error: err } = await supabase.from('fornitori').insert([{ ...form, sede_id: sedeId }])

    setSaving(false)
    if (err) { setError(err.message); return }
    router.push('/fornitori')
    router.refresh()
  }

  const inputCls = 'w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1a3050] focus:border-transparent bg-white'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <div className="p-4 md:p-8 max-w-lg">
      <div className="flex items-center gap-3 mb-8">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{t.fornitori.new}</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        <div>
          <label className={labelCls}>{t.fornitori.nome} *</label>
          <input className={inputCls} required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder={t.fornitori.namePlaceholder} />
        </div>
        <div>
          <label className={labelCls}>{t.fornitori.email}</label>
          <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t.fornitori.emailPlaceholder} />
        </div>
        <div>
          <label className={labelCls}>{t.fornitori.pivaLabel}</label>
          <input className={inputCls} value={form.piva} onChange={(e) => setForm({ ...form, piva: e.target.value })} placeholder={t.fornitori.pivaPlaceholder} />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            {t.common.cancel}
          </button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 text-sm font-medium bg-[#1a3050] hover:bg-[#122238] disabled:opacity-60 text-white rounded-lg transition-colors">
            {saving ? t.fornitori.saving : t.common.save}
          </button>
        </div>
      </form>
    </div>
  )
}
