'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

export default function EditBollaImporto({ id, importo }: { id: string; importo: number | null }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(importo != null ? String(importo) : '')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSave = async () => {
    const parsed = value.trim() !== '' ? parseFloat(value) : null
    if (parsed != null && !Number.isFinite(parsed)) return
    setSaving(true)
    await supabase.from('bolle').update({ importo: parsed }).eq('id', id)
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  const handleCancel = () => {
    setValue(importo != null ? String(importo) : '')
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-semibold text-app-fg-muted">£</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void handleSave()
            if (e.key === 'Escape') handleCancel()
          }}
          className="w-24 rounded border border-app-line-28 bg-app-line-5 px-1.5 py-0.5 text-sm font-semibold tabular-nums text-app-fg focus:border-app-a-55 focus:outline-none focus:ring-1 focus:ring-app-a-30"
          autoFocus
        />
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-50"
        >
          {saving ? '…' : 'Salva'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-app-fg-muted hover:bg-white/5"
        >
          Annulla
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="group flex items-center gap-1.5 text-left"
      title="Clicca per modificare l'importo"
    >
      {importo != null ? (
        <span className="font-semibold text-app-fg">£ {Number(importo).toFixed(2)}</span>
      ) : (
        <span className="text-app-fg-muted">—</span>
      )}
      <svg
        className="h-3.5 w-3.5 shrink-0 text-app-fg-muted opacity-0 transition-opacity group-hover:opacity-100"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </button>
  )
}
