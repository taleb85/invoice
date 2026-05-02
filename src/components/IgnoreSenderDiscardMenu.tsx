'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Ban, ChevronDown } from 'lucide-react'
import { useToast } from '@/lib/toast-context'
import { useLocale } from '@/lib/locale-context'

type Props = {
  mittente: string
  sedeId: string | null | undefined
  documentoId?: string | null
  successBlacklistMessage?: string
}

export default function IgnoreSenderDiscardMenu({
  mittente,
  sedeId,
  documentoId,
  successBlacklistMessage,
}: Props) {
  const { showToast } = useToast()
  const { t } = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const sid = sedeId?.trim()
  if (!sid) return null

  const runBlacklist = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/email-blacklist', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mittente,
          motivo: 'non_fornitore',
          sede_id: sid,
        }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        showToast(j.error ?? t.log.blacklistError, 'error')
        return
      }
      const doc = documentoId?.trim()
      if (doc) {
        const sc = await fetch('/api/documenti-da-processare', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: doc, azione: 'scarta' }),
        })
        if (!sc.ok) {
          const sj = (await sc.json().catch(() => ({}))) as { error?: string }
          showToast(sj.error ?? t.log.blacklistError, 'error')
          return
        }
      }
      showToast(
        successBlacklistMessage?.trim()
          ? successBlacklistMessage
          : doc
            ? t.log.activityIgnoreSenderDoneToast
            : t.log.activityBlacklistConfirmToast,
        'success',
      )
      router.refresh()
    } catch {
      showToast(t.log.blacklistError, 'error')
    } finally {
      setBusy(false)
    }
  }

  const postRule = async (tipo: 'mittente' | 'parola_chiave', valore: string, motivo: string | null) => {
    const res = await fetch('/api/ocr-scarto-rules', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sede_id: sid,
        tipo,
        valore,
        motivo,
        attivo: true,
      }),
    })
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error ?? 'api')
    }
  }

  const createMittenteRule = async () => {
    try {
      const email = mittente.includes('@')
        ? mittente.trim().toLowerCase()
        : mittente.trim()
      await postRule('mittente', email, 'Da log attività')
      showToast(t.log.ocrDiscardRulesSavedToast, 'success')
      router.refresh()
    } catch {
      showToast(t.log.blacklistError, 'error')
    }
  }

  const createKeywordRule = async () => {
    const raw =
      typeof window !== 'undefined'
        ? window.prompt(t.log.ocrDiscardRulesKeywordPrompt)?.trim()
        : ''
    if (!raw || raw.length < 2) return
    try {
      await postRule('parola_chiave', raw, 'Da log attività — parola chiave')
      showToast(t.log.ocrDiscardRulesSavedToast, 'success')
      router.refresh()
    } catch {
      showToast(t.log.blacklistError, 'error')
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 max-w-[12rem] items-center gap-1 rounded-md border border-rose-500/35 bg-rose-950/45 px-2 text-rose-100 transition-colors hover:border-rose-400/45 hover:bg-rose-950/70 disabled:opacity-50 touch-manipulation"
      >
        <Ban className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        <span className="min-w-0 truncate text-[11px] font-semibold">{t.log.ocrDiscardRulesMenuAria}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      </button>
      {open ? (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[90] cursor-default border-0 bg-transparent p-0"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute end-0 z-[100] mt-1 min-w-[16rem] max-w-[min(100vw-2rem,20rem)] rounded-lg border border-white/15 bg-[#111822] py-1 text-xs shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-start text-[11px] font-semibold text-rose-100 hover:bg-white/10"
              onClick={() => {
                setOpen(false)
                void runBlacklist()
              }}
            >
              {t.log.activityIgnoreMenuBlacklist}
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-start text-[11px] text-teal-100 hover:bg-white/10"
              onClick={() => {
                setOpen(false)
                void createMittenteRule()
              }}
            >
              {t.log.activityIgnoreMenuRuleMittente}
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-start text-[11px] text-cyan-100 hover:bg-white/10"
              onClick={() => {
                setOpen(false)
                void createKeywordRule()
              }}
            >
              {t.log.activityIgnoreMenuRuleKeyword}
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
