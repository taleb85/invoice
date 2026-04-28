'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { useT } from '@/lib/use-t'
import AppPageHeaderStrip from '@/components/AppPageHeaderStrip'
import { BackButton } from '@/components/BackButton'
import { APP_FORNITORE_FORM_PAGE_SHELL_CLASS, APP_SHELL_SECTION_PAGE_H1_CLASS } from '@/lib/app-shell-layout'
import { extractRekkiSupplierIdFromUrl } from '@/lib/rekki-extract-id'
import { readReturnToFromGetter } from '@/lib/return-navigation'

interface AliasEmail {
  id: string
  email: string
  label: string | null
}

/** Campi su canvas / guscio trasparente: leggibilità senza secondo strato “vetro”. */
const fieldBaseCls =
  'w-full rounded-xl border border-app-line-28 app-workspace-inset-bg-soft px-3.5 py-2.5 text-sm text-app-fg placeholder:text-app-fg-muted transition [color-scheme:dark] focus:border-app-line-50 focus:outline-none focus:ring-2 focus:ring-app-line-50'
/** `appearance-none` su input evita lo stile nativo chiaro su mobile; il select resta nativo per il menu. */
const inputCls = `${fieldBaseCls} appearance-none`
const selectCls = fieldBaseCls
const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-app-fg-muted'

/** Sezioni modulo: stesso contorno di `.app-card` ma `bg-transparent` così il gradiente `#app-main` resta visibile. */
const editSectionShellCls =
  'relative overflow-hidden rounded-lg border border-app-line-25 bg-white/[0.04] text-app-fg shadow-[0_0_20px_-10px_rgba(6,182,212,0.28),0_16px_40px_-14px_rgba(0,0,0,0.22)] ring-1 ring-inset ring-white/10'
const editSectionBodyCls = 'space-y-4 bg-transparent p-6'

export default function EditFornitore() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()
  const t = useT()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    nome: '',
    display_name: '',
    logo_url: '',
    email: '',
    piva: '',
    indirizzo: '',
    rekki_link: '',
    rekki_supplier_id: '',
    language: '',
  })

  const [aliases, setAliases] = useState<AliasEmail[]>([])
  const [newAlias, setNewAlias] = useState({ email: '', label: '' })
  const [addingAlias, setAddingAlias] = useState(false)
  const [deletingAliasId, setDeletingAliasId] = useState<string | null>(null)

  const loadAliases = useCallback(async () => {
    const { data } = await supabase
      .from('fornitore_emails')
      .select('id, email, label')
      .eq('fornitore_id', id)
      .order('created_at')
    setAliases(data ?? [])
  }, [id, supabase])

  useEffect(() => {
    async function load() {
      const [{ data, error }] = await Promise.all([
        supabase.from('fornitori').select('*').eq('id', id).single(),
        loadAliases(),
      ])

      if (error || !data) {
        setError(t.fornitori.notFound)
      } else {
        const row = data as {
          display_name?: string | null
          indirizzo?: string | null
          rekki_link?: string | null
          rekki_supplier_id?: string | null
        }
        setForm({
          nome: data.nome ?? '',
          display_name: (row.display_name ?? '').toLocaleUpperCase(),
          logo_url: (data as { logo_url?: string | null }).logo_url ?? '',
          email: data.email ?? '',
          piva: data.piva ?? '',
          indirizzo: row.indirizzo ?? '',
          rekki_link: row.rekki_link ?? '',
          rekki_supplier_id: row.rekki_supplier_id ?? '',
          language: data.language ?? '',
        })
      }
      setLoading(false)
    }
    load()
  }, [id, loadAliases, supabase, t.fornitori.notFound])

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

  const handleCloseEdit = () => {
    const r = readReturnToFromGetter((k) =>
      typeof window !== 'undefined' ? new URL(window.location.href).searchParams.get(k) : null,
    )
    if (r) router.push(r)
    else router.back()
    router.refresh()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const rawRekkiId = form.rekki_supplier_id.trim()
    const rekkiSupplierId =
      (extractRekkiSupplierIdFromUrl(rawRekkiId) ?? rawRekkiId).trim() || null

    const { error: err } = await supabase
      .from('fornitori')
      .update({
        nome: form.nome,
        display_name: form.display_name.trim().toLocaleUpperCase() || null,
        email: form.email || null,
        piva: form.piva || null,
        indirizzo: form.indirizzo.trim() || null,
        rekki_link: form.rekki_link.trim() || null,
        rekki_supplier_id: rekkiSupplierId,
        language: form.language || null,
      })
      .eq('id', id)

    setSaving(false)
    if (err) { setError(err.message); return }
    handleCloseEdit()
  }

  if (loading) {
    return (
      <div className={APP_FORNITORE_FORM_PAGE_SHELL_CLASS}>
        <div
          className="flex min-h-[12rem] items-center justify-center"
          role="status"
          aria-busy="true"
          aria-live="polite"
          aria-label={t.appStrings.loadingPage}
        >
          <div
            className="size-6 shrink-0 animate-spin rounded-full border-2 border-app-cyan-500 border-t-transparent"
            aria-hidden
          />
        </div>
      </div>
    )
  }

  return (
    <div className={APP_FORNITORE_FORM_PAGE_SHELL_CLASS}>
      <BackButton href={`/fornitori/${id}`} label={t.common.supplier} />
      <AppPageHeaderStrip accent="sky" flushBottom icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <h1 className={`app-page-title min-w-0 flex-1 ${APP_SHELL_SECTION_PAGE_H1_CLASS}`}>{t.fornitori.editTitle}</h1>
        </div>
      </AppPageHeaderStrip>

      <form onSubmit={handleSubmit} className={`${editSectionShellCls} mb-6`}>
        <div className="app-card-bar" aria-hidden />
        <div className={editSectionBodyCls}>
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
            <p className="mt-1 text-[11px] text-app-fg-muted">{t.fornitori.displayNameHint}</p>
          </div>
          <div>
            <label className={labelCls}>{t.fornitori.logoUrlLabel}</label>
            <input
              type="url"
              className={inputCls}
              value={form.logo_url}
              onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              placeholder={t.fornitori.logoUrlPlaceholder}
              inputMode="url"
              autoComplete="off"
            />
            <p className="mt-1 text-[11px] text-app-fg-muted">{t.fornitori.logoUrlHint}</p>
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
          <div>
            <label className={labelCls}>{t.fornitori.rekkiLinkLabel}</label>
            <input
              type="url"
              className={inputCls}
              value={form.rekki_link}
              onChange={(e) => setForm({ ...form, rekki_link: e.target.value })}
              placeholder={t.fornitori.rekkiLinkPlaceholder}
            />
          </div>
          <div>
            <label className={labelCls}>{t.fornitori.rekkiIdLabel}</label>
            <input
              className={inputCls}
              value={form.rekki_supplier_id}
              onChange={(e) => setForm({ ...form, rekki_supplier_id: e.target.value })}
              placeholder={t.fornitori.rekkiIdPlaceholder}
            />
          </div>
          <div>
            <label className={labelCls}>{t.fornitori.preferredLanguageEmail}</label>
            <select
              className={selectCls}
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
            >
              <option value="">{t.fornitori.languageInheritSede}</option>
              <option value="it">🇮🇹 Italiano</option>
              <option value="en">🇬🇧 English</option>
              <option value="fr">🇫🇷 Français</option>
              <option value="de">🇩🇪 Deutsch</option>
              <option value="es">🇪🇸 Español</option>
            </select>
          </div>

          {error && (
            <p className="rounded-xl border border-[rgba(34,211,238,0.15)] app-workspace-inset-bg-soft px-4 py-2.5 text-sm text-red-200/95">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCloseEdit}
              className="flex-1 rounded-xl border border-app-line-32 app-workspace-inset-bg py-2.5 text-sm font-medium text-app-fg-muted transition-colors hover:bg-black/18"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-app-cyan-500 py-2.5 text-sm font-semibold text-cyan-950 transition-colors hover:bg-app-cyan-400 disabled:opacity-60"
            >
              {saving ? t.fornitori.saving : t.fornitori.saveChanges}
            </button>
          </div>
        </div>
      </form>

      <div className={editSectionShellCls}>
        <div className="app-card-bar" aria-hidden />
        <div className={editSectionBodyCls}>
          <div>
            <h2 className="text-sm font-semibold text-app-fg">{t.fornitori.recognizedEmailsTitle}</h2>
            <p className="mt-0.5 text-xs text-app-fg-muted">{t.fornitori.recognizedEmailsHint}</p>
          </div>

          {aliases.length > 0 && (
            <div className="space-y-1.5">
              {aliases.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-app-line-22 app-workspace-inset-bg-soft px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-app-fg">{a.email}</p>
                    {a.label && <p className="text-xs text-app-fg-muted">{a.label}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteAlias(a.id)}
                    disabled={deletingAliasId === a.id}
                    className="shrink-0 rounded-lg p-1.5 text-app-fg-muted transition-colors hover:bg-red-950/40 hover:text-red-400 disabled:opacity-40"
                  >
                    {deletingAliasId === a.id ? (
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="email"
                placeholder={t.fornitori.recognizedEmailPlaceholder}
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
              className="w-full rounded-xl border border-dashed border-app-line-28 py-2 text-sm font-medium text-app-fg-muted transition-colors hover:border-app-a-45 hover:bg-app-line-10 hover:text-app-fg disabled:opacity-40"
            >
              {addingAlias ? t.appStrings.addingAlias : t.appStrings.addEmailAlias}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
