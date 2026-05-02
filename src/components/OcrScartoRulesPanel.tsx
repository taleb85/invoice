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

/** Gestione `ocr_scarto_rules`: tab blacklist log email o Impostazioni. */
export default function OcrScartoRulesPanel({
  sedeId,
  variant = 'embeddedInLogTab',
}: {
  sedeId: string
  variant?: 'embeddedInLogTab' | 'settingsPage'
}) {
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

  const outerCls =
    variant === 'settingsPage'
      ? 'flex flex-col gap-0'
      : 'space-y-4 border-t border-white/10 pt-5'

  const fieldCls =
    'w-full rounded-lg border border-app-line-35 bg-black/30 px-3 py-2 text-sm text-app-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ring-1 ring-black/25 placeholder:text-app-fg-muted focus:border-app-a-55 focus:outline-none focus:ring-2 focus:ring-app-a-35'
  const labelCls = 'flex flex-col gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-app-fg-muted'

  /** Etichette form Impostazioni: meno grid “tabella”, più leggibili del log tab */
  const settingsFormLabelCls = 'flex flex-col gap-1.5 text-xs font-medium leading-snug text-app-fg-muted'

  const showIntroBlock = variant === 'embeddedInLogTab'

  const composeForm =
    variant === 'settingsPage' ? (
      <div className="rounded-xl border border-app-line-28 bg-black/[0.12] p-4 ring-1 ring-white/[0.04] sm:p-5">
        <div className="border-b border-app-line-22 pb-4">
          <h3 className="text-sm font-semibold text-app-fg">{tg.ocrDiscardRulesAdd}</h3>
        </div>
        <div className="grid gap-6 pt-5 sm:grid-cols-[minmax(0,15rem)_1fr] sm:gap-8 lg:grid-cols-[minmax(0,17rem)_1fr]">
          <label className={settingsFormLabelCls}>
            <span className="text-app-fg">{tg.ocrDiscardRulesColTipo}</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as OcrScartoRuleTipo)}
              className={`${fieldCls} min-h-[2.75rem] text-[13px] leading-snug`}
            >
              {OCR_SCARTO_RULE_TIPOS.map((k) => (
                <option key={k} value={k}>
                  {tipoUiLabel(tg, k)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex min-w-0 flex-col gap-4">
            <label className={settingsFormLabelCls}>
              <span className="text-app-fg">{tg.ocrDiscardRulesColValore}</span>
              <input
                value={valore}
                onChange={(e) => setValore(e.target.value)}
                placeholder={tg.ocrDiscardRulesValorePlaceholder}
                className={fieldCls}
              />
            </label>
            <label className={`${settingsFormLabelCls} gap-1.5`}>
              <span className="text-app-fg">{tg.ocrDiscardRulesColMotivo}</span>
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder={tg.ocrDiscardRulesMotivoPlaceholder}
                className={fieldCls}
              />
              <p className="text-[11px] font-normal leading-relaxed text-app-fg-muted">{tg.ocrDiscardRulesMotivoHint}</p>
            </label>
            <div className="flex justify-end border-t border-app-line-20 pt-4">
              <button
                type="button"
                disabled={busy || !valore.trim()}
                onClick={() => void addRule()}
                className="rounded-lg bg-teal-600/90 px-4 py-2.5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] hover:bg-teal-600 disabled:opacity-35"
              >
                {tg.ocrDiscardRulesAdd}
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div className="grid gap-2 sm:grid-cols-12 sm:items-end">
        <label className={`${labelCls} sm:col-span-3`}>
          {tg.ocrDiscardRulesColTipo}
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as OcrScartoRuleTipo)}
            className={`${fieldCls} py-1.5 text-xs`}
          >
            {OCR_SCARTO_RULE_TIPOS.map((k) => (
              <option key={k} value={k}>
                {tipoUiLabel(tg, k)}
              </option>
            ))}
          </select>
        </label>
        <label className={`${labelCls} sm:col-span-4`}>
          {tg.ocrDiscardRulesColValore}
          <input
            value={valore}
            onChange={(e) => setValore(e.target.value)}
            placeholder={tg.ocrDiscardRulesValorePlaceholder}
            className={`${fieldCls} py-1.5 text-xs`}
          />
        </label>
        <label className={`${labelCls} sm:col-span-4`}>
          {tg.ocrDiscardRulesColMotivo}{' '}
          <span className="sr-only">{tg.ocrDiscardRulesMotivoHint}</span>
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={tg.ocrDiscardRulesMotivoPlaceholder}
            className={`${fieldCls} py-1.5 text-xs`}
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
    )

  const listBlock =
    rows.length === 0 ? (
      <p className="rounded-lg border border-dashed border-app-line-35 bg-black/15 px-4 py-6 text-center text-sm text-app-fg-muted">{tg.ocrDiscardRulesEmpty}</p>
    ) : (
      <div className="space-y-2">
        {variant === 'settingsPage' ? (
          <div
            className="hidden gap-3 px-1 pb-2 text-[11px] font-semibold text-app-fg-muted sm:grid sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,9rem)_auto]"
            aria-hidden
          >
            <span>{tg.ocrDiscardRulesColTipo}</span>
            <span>{tg.ocrDiscardRulesColValore}</span>
            <span>{tg.ocrDiscardRulesColMotivo}</span>
            <span className="text-end">{tg.ocrDiscardRulesColActions}</span>
          </div>
        ) : null}
        <ul className={`${variant === 'settingsPage' ? 'max-h-[min(26rem,calc(100dvh-20rem))]' : 'max-h-[22rem]'} space-y-2 overflow-y-auto pr-1`}>
          {rows.map((r) =>
            variant === 'settingsPage' ? (
              <li
                key={r.id}
                className="grid grid-cols-1 gap-3 rounded-xl border border-app-line-28 bg-black/25 px-3 py-3 ring-1 ring-white/[0.04] sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)_minmax(0,9rem)_auto] sm:items-start sm:gap-3"
              >
                <span className="inline-flex max-w-full items-center rounded-md bg-white/[0.08] px-2 py-1.5 text-[11px] font-semibold leading-snug text-teal-100/95">
                  {tipoUiLabel(tg, r.tipo)}
                </span>
                <p className="min-w-0 break-all text-sm font-medium text-app-fg">{r.valore}</p>
                <div className="min-w-0">
                  {r.motivo?.trim() ? (
                    <p className="break-words text-xs leading-snug text-app-fg-muted">{r.motivo}</p>
                  ) : (
                    <span className="text-xs text-app-fg-subtle">—</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-col sm:items-end sm:gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] tabular-nums text-app-fg-muted">
                    <input
                      type="checkbox"
                      checked={r.attivo}
                      disabled={busy}
                      onChange={() => void toggle(r.id, !r.attivo)}
                      className="rounded border-white/35"
                    />
                    {tg.ocrDiscardRulesColAttivo}
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void del(r.id)}
                    className="rounded-lg border border-rose-500/40 bg-rose-950/35 px-2.5 py-1 text-[11px] font-semibold text-rose-100 transition-colors hover:bg-rose-950/50 disabled:opacity-40"
                  >
                    {tg.ocrDiscardRulesDelete}
                  </button>
                </div>
              </li>
            ) : (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/25 px-2 py-2 text-xs"
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
            ),
          )}
        </ul>
      </div>
    )

  return (
    <div className={outerCls}>
      {showIntroBlock ? (
        <div>
          <h3 className="text-sm font-semibold text-teal-100/95">{tg.ocrDiscardRulesTitle}</h3>
          <p className="mt-1 text-xs leading-relaxed text-app-fg-muted">{tg.ocrDiscardRulesSubtitle}</p>
        </div>
      ) : null}

      {variant === 'settingsPage' ? (
        <>
          {composeForm}
          <div className="mt-8 border-t border-app-line-25 pt-6">
            {listBlock}
          </div>
        </>
      ) : (
        <>
          {composeForm}
          <div>{listBlock}</div>
        </>
      )}
    </div>
  )
}
