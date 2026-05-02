'use client'

import { useState } from 'react'

type Props = {
  sedeId: string
  /** Da DB o, se vuoto, valori effettivi di default mostrati all’utente */
  initialNames: string[]
  canEdit: boolean
  /** Senza cornice propria — dentro raggruppamento Impostazioni */
  embedded?: boolean
}

export default function SedeOcrIgnoreNamesEditor({ sedeId, initialNames, canEdit, embedded = false }: Props) {
  const [names, setNames] = useState<string[]>(() => [...initialNames])
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canEdit) return null

  function add() {
    const t = draft.trim()
    if (!t) return
    if (names.some((n) => n.toLowerCase() === t.toLowerCase())) {
      setDraft('')
      return
    }
    setNames([...names, t])
    setDraft('')
    setSaved(false)
  }

  function removeAt(i: number) {
    setNames(names.filter((_, j) => j !== i))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/sedi/${sedeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nomi_cliente_da_ignorare: names }),
      })
      const d = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(typeof d.error === 'string' ? d.error : 'Errore salvataggio')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError('Errore di rete')
    } finally {
      setSaving(false)
    }
  }

  const header = (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15">
        <svg className="h-4 w-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-snug text-app-fg">Nomi azienda da ignorare nell&apos;OCR</p>
        <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">
          Destinatari/clienti della sede: non usarli come fornitore su fatture e DDT. Elenco salvato nella sede.
        </p>
      </div>
    </div>
  )

  const body = (
    <>
      <ul className="flex flex-col gap-2 sm:gap-2">
        {names.length === 0 ? (
          <li className="rounded-lg border border-dashed border-app-line-35 bg-black/10 px-3 py-3 text-sm text-app-fg-muted">
            Nessun nome — aggiungi almeno il nome del locale o della società.
          </li>
        ) : (
          names.map((n, i) => (
            <li
              key={`${n}-${i}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-app-line-20 bg-app-line-08 px-3 py-2.5"
            >
              <span className="min-w-0 flex-1 text-sm leading-snug text-app-fg">{n}</span>
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-500/15"
              >
                Rimuovi
              </button>
            </li>
          ))
        )}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Aggiungi nome (es. nuovo locale)"
          className="min-w-0 flex-1 rounded-lg border border-app-line-25 bg-[#0b1222] px-3 py-2 text-sm text-app-fg placeholder:text-app-fg-placeholder focus:border-app-cyan-500 focus:outline-none focus:ring-2 focus:ring-app-line-30"
        />
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={add}
            className="rounded-lg border border-app-line-25 bg-app-line-08 px-4 py-2 text-sm font-medium text-app-fg hover:bg-app-line-15"
          >
            Aggiungi
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-app-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-app-cyan-500 disabled:opacity-50"
          >
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-400">{error}</p> : null}
      {saved ? <p className="text-sm text-emerald-400">Salvato.</p> : null}
    </>
  )

  if (embedded) {
    return (
      <div className="space-y-4">
        {header}
        {body}
      </div>
    )
  }

  return (
    <article className="min-h-0 min-w-0 overflow-hidden rounded-2xl border border-app-line-22 bg-[#0f172b]/60">
      <div className="border-b border-app-line-22 app-workspace-inset-bg-soft px-5 py-4 sm:px-6">{header}</div>
      <div className="space-y-4 px-5 py-5 sm:px-6 sm:pb-6">{body}</div>
    </article>
  )
}
