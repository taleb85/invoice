'use client'

import { useCallback, useEffect, useState } from 'react'
import { OCR_SCARTO_RULE_TIPOS, type OcrScartoRuleTipo } from '@/lib/ocr-scarto-rules'
import { useLocale } from '@/lib/locale-context'

type RuleRow = {
  id: string
  sede_id: string
  tipo: string
  valore: string
  motivo: string | null
  attivo: boolean
  created_at: string
}


function tipoUiLabel(
  tg: Readonly<{ ocrDiscardRulesTipoMittente: string; ocrDiscardRulesTipoDominio: string; ocrDiscardRulesTipoParolaChiave: string; ocrDiscardRulesTipoTipoDocumento: string }>,
  tipoRaw: string,
): string {
  const k = tipoRaw.trim().toLowerCase()
  if (k === 'mittente') return tg.ocrDiscardRulesTipoMittente
  if (k === 'dominio') return tg.ocrDiscardRulesTipoDominio
  if (k === 'parola_chiave') return tg.ocrDiscardRulesTipoParolaChiave
  if (k === 'tipo_documento') return tg.ocrDiscardRulesTipoTipoDocumento
  return tipoRaw
}

/** Gestione `ocr_scarto_rules` nella tab blacklist del log email (`sede_id` risolto lato SSR). */
export default function OcrScartoRulesPanel({ sedeId }: { sedeId: string }) {
  const { t } = useLocale()
  const tg = t.log

  const [rows, setRows] = useState<RuleRow[] | null>(null)
  const [loadErr, setLoadErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tipo, setTipo] = useState<OcrScartoRuleTipo>('mittente')
  const [valore, setValore] = useState('')
  const [motivo, setMotivo] = useState('')

  const reload = useCallback(async () => {
    setLoadErr(false)
    try {
      const qs = new URLSearchParams({ sede_id: sedeId, include_inactive: '1' })
      const res = await fetch(`/api/ocr-scarto-rules?${qs}`, { credentials: 'include' })
      if (!res.ok) throw new Error('load')
      const j = (await res.json()) as { rows?: RuleRow[] }
      setRows(j.rows ?? [])
    } catch {
      setLoadErr(true)
      setRows(null)
    }
  }, [sedeId])

  useEffect(() => {
    void reload()
  }, [reload])

  const addRule = async () => {
    const v = valore.trim()
    if (!v) return
    setBusy(true)
    try {
      const res = await fetch('/api/ocr-scarto-rules', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sede_id: sedeId,
          tipo,
          valore: v,
          motivo: motivo.trim() || null,
          attivo: true,
        }),
      })
      if (!res.ok) throw new Error('post')
      setValore('')
      setMotivo('')
      void reload()
      window.alert(tg.ocrDiscardRulesSavedToast)
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (id: string, attivo: boolean) => {
    setBusy(true)
    try {
      const res = await fetch('/api/ocr-scarto-rules', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, attivo }),
      })
      if (!res.ok) throw new Error('patch')
      void reload()
    } finally {
      setBusy(false)
    }
  }

  const del = async (id: string) => {
    if (!window.confirm(`${tg.ocrDiscardRulesDelete}?`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/ocr-scarto-rules?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('delete')
      void reload()
    } finally {
      setBusy(false)
    }
  }

  if (loadErr) return <p className="text-sm text-red-400">{tg.ocrDiscardRulesLoadErr}</p>
  if (rows === null) return <p className="text-sm text-app-fg-muted">…</p>

  return (
    <div className="space-y-4 border-t border-white/10 pt-5">
      <div>
        <h3 className="text-sm font-semibold text-teal-100/95">{tg.ocrDiscardRulesTitle}</h3>
        <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">{tg.ocrDiscardRulesSubtitle}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-12 sm:items-end">
        <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted sm:col-span-3">
          {tg.ocrDiscardRulesColTipo}
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as OcrScartoRuleTipo)}
            className="rounded-md border border-app-soft-border bg-black/30 px-2 py-1.5 text-xs text-app-fg"
          >
            {OCR_SCARTO_RULE_TIPOS.map((k) => (
              <option key={k} value={k}>
                {tipoUiLabel(tg, k)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted sm:col-span-4">
          {tg.ocrDiscardRulesColValore}
          <input
            value={valore}
            onChange={(e) => setValore(e.target.value)}
            placeholder={tg.ocrDiscardRulesValorePlaceholder}
            className="rounded-md border border-app-soft-border bg-black/30 px-2 py-1.5 text-xs text-app-fg placeholder:text-app-fg-muted"
          />
        </label>
        <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted sm:col-span-4">
          {tg.ocrDiscardRulesColMotivo}{' '}
          <span className="sr-only">{tg.ocrDiscardRulesMotivoHint}</span>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={tg.ocrDiscardRulesMotivoPlaceholder}
            className="rounded-md border border-app-soft-border bg-black/30 px-2 py-1.5 text-xs text-app-fg placeholder:text-app-fg-muted"
          />
        </label>
        <button
          type="button"
          disabled={busy || !valore.trim()}
          onClick={() => void addRule()}
          className="rounded-lg bg-teal-600/85 px-3 py-2 text-xs font-bold text-white hover:bg-teal-600 disabled:opacity-35 sm:col-span-1"
        >
          {tg.ocrDiscardRulesAdd}
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-app-fg-muted">{tg.ocrDiscardRulesEmpty}</p>
      ) : (
        <ul className="max-h-[22rem] space-y-2 overflow-y-auto pr-1 text-xs">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-2 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-app-fg">
                  <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-teal-100/95">
                    {tipoUiLabel(tg, r.tipo)}
                  </span>{' '}
                  <span className="break-all">{r.valore}</span>
                </p>
                {r.motivo?.trim() ? (
                  <p className="mt-1 text-[11px] text-app-fg-muted">{r.motivo}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <label className="flex items-center gap-1 text-[11px] text-app-fg-muted">
                  <input
                    type="checkbox"
                    checked={r.attivo}
                    disabled={busy}
                    onChange={() => void toggle(r.id, !r.attivo)}
                    className="rounded border-white/30"
                  />
                  {tg.ocrDiscardRulesColAttivo}
                </label>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void del(r.id)}
                  className="rounded-md border border-rose-500/35 bg-rose-950/30 px-2 py-1 text-[11px] font-semibold text-rose-100 hover:bg-rose-950/50 disabled:opacity-40"
                >
                  {tg.ocrDiscardRulesDelete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
