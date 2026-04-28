'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { EMAIL_BLACKLIST_MOTIVI, type EmailBlacklistMotivo } from '@/lib/email-scan-blacklist'
import { useLocale } from '@/lib/locale-context'

type Row = {
  id: string
  mittente: string
  motivo: string
  created_at: string
}

function motivoLabel(t: { log: Record<string, string> }, m: string): string {
  const map: Record<string, string> = {
    newsletter: 'blacklistMotivoNewsletter',
    spam: 'blacklistMotivoSpam',
    non_fornitore: 'blacklistMotivoNonFornitore',
    sistema: 'blacklistMotivoSistema',
    social: 'blacklistMotivoSocial',
  }
  const k = map[m]
  return k && t.log[k] !== undefined ? (t.log[k] as string) : m
}

/** Gestione blacklist OCR per sede (`sede_id` sempre risolto lato pagina server). */
export default function EmailBlacklistPanel({ sedeId }: { sedeId: string }) {
  const { t } = useLocale()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [loadErr, setLoadErr] = useState(false)
  const [motivoFilter, setMotivoFilter] = useState<'' | EmailBlacklistMotivo>('')
  const [mittInput, setMittInput] = useState('')
  const [motivoAdd, setMotivoAdd] = useState<EmailBlacklistMotivo>('non_fornitore')
  const [busy, setBusy] = useState(false)

  const buildListUrl = useMemo(() => {
    const q = new URLSearchParams({ sede_id: sedeId })
    if (motivoFilter) q.set('motivo', motivoFilter)
    return `/api/email-blacklist?${q}`
  }, [motivoFilter, sedeId])

  const reload = useCallback(async () => {
    setLoadErr(false)
    try {
      const res = await fetch(buildListUrl, { credentials: 'include' })
      if (!res.ok) throw new Error('load')
      const j = (await res.json()) as { rows?: Row[] }
      setRows(j.rows ?? [])
    } catch {
      setLoadErr(true)
      setRows(null)
    }
  }, [buildListUrl])

  useEffect(() => {
    void reload()
  }, [reload])

  const deleteRow = async (mittente: string) => {
    const q = new URLSearchParams({
      mittente,
      sede_id: sedeId,
    }).toString()
    const res = await fetch(`/api/email-blacklist?${q}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) throw new Error('del')
  }

  const addRow = async () => {
    const mittente = mittInput.trim()
    if (!mittente) return
    setBusy(true)
    try {
      const body = JSON.stringify({
        mittente,
        motivo: motivoAdd,
        sede_id: sedeId,
      })
      const res = await fetch('/api/email-blacklist', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      if (!res.ok) throw new Error('post')
      setMittInput('')
      void reload()
    } finally {
      setBusy(false)
    }
  }

  if (loadErr) {
    return <p className="text-sm text-red-400">{t.log.blacklistError}</p>
  }

  if (rows === null) {
    return <p className="text-sm text-app-fg-muted">…</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-app-fg-muted">{t.log.blacklistSubtitle}</p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-app-fg-muted">
          {t.log.blacklistColMotivo}
          <select
            value={motivoFilter}
            onChange={(e) => setMotivoFilter((e.target.value || '') as '' | EmailBlacklistMotivo)}
            className="rounded-md border border-app-soft-border bg-black/30 px-2 py-1.5 text-xs text-app-fg"
          >
            <option value="">{t.log.blacklistFilterAll}</option>
            {EMAIL_BLACKLIST_MOTIVI.map((m) => (
              <option key={m} value={m}>
                {motivoLabel(t, m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-app-soft-border pt-4">
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-app-fg-muted">
          {t.log.blacklistColMittente}
          <input
            type="text"
            value={mittInput}
            onChange={(e) => setMittInput(e.target.value)}
            placeholder={t.log.blacklistPlaceholder}
            className="rounded-md border border-app-soft-border bg-black/30 px-2 py-1.5 font-mono text-xs text-app-fg placeholder:text-app-fg-muted/50"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wider text-app-fg-muted">
          {t.log.blacklistColMotivo}
          <select
            value={motivoAdd}
            onChange={(e) => setMotivoAdd(e.target.value as EmailBlacklistMotivo)}
            className="rounded-md border border-app-soft-border bg-black/30 px-2 py-1.5 text-xs text-app-fg"
          >
            {EMAIL_BLACKLIST_MOTIVI.map((m) => (
              <option key={m} value={m}>
                {motivoLabel(t, m)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={busy || !mittInput.trim()}
          onClick={() => void addRow()}
          className="rounded-md bg-app-cyan-600/30 px-3 py-1.5 text-xs font-semibold text-app-cyan-200 hover:bg-app-cyan-600/45 disabled:opacity-40"
        >
          {t.log.blacklistAdd}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-app-fg-muted">{t.log.blacklistEmpty}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-app-soft-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-app-soft-border bg-black/25">
                <th className="px-3 py-2 font-semibold text-app-fg-muted">{t.log.blacklistColMittente}</th>
                <th className="px-3 py-2 font-semibold text-app-fg-muted">{t.log.blacklistColMotivo}</th>
                <th className="px-3 py-2 font-semibold text-app-fg-muted">{t.log.blacklistColDate}</th>
                <th className="px-3 py-2 font-semibold text-app-fg-muted">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-app-line-25 align-top hover:bg-white/[0.03]">
                  <td className="max-w-[220px] break-all px-3 py-2 font-mono text-app-fg">{r.mittente}</td>
                  <td className="px-3 py-2 text-app-fg-muted">{motivoLabel(t, r.motivo)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-app-fg-muted">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true)
                        try {
                          await deleteRow(r.mittente)
                          void reload()
                        } finally {
                          setBusy(false)
                        }
                      }}
                      className="text-xs font-medium text-red-400 hover:underline disabled:opacity-40"
                    >
                      {t.log.blacklistRemove}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
