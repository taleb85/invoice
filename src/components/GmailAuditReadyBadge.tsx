'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useT } from '@/lib/use-t'

interface GmailAuditReadyBadgeProps {
  fornitoreNome: string
}

export default function GmailAuditReadyBadge({ fornitoreNome }: GmailAuditReadyBadgeProps) {
  const t = useT()
  const [show, setShow] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [gmailStatus, setGmailStatus] = useState<{
    configured: boolean
    connected: boolean
  } | null>(null)

  useEffect(() => {
    const dismissedKey = `gmail-audit-banner-dismissed-${fornitoreNome}`
    if (localStorage.getItem(dismissedKey) === 'true') {
      setDismissed(true)
      return
    }
    checkGmailStatus()
  }, [fornitoreNome])

  const checkGmailStatus = async () => {
    try {
      const res = await fetch('/api/auth/google/status', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setGmailStatus(data)
        if (!data.connected) setShow(true)
      }
    } catch (err) {
      console.error('[GMAIL-BADGE] Error:', err)
    }
  }

  const handleDismiss = () => {
    const dismissedKey = `gmail-audit-banner-dismissed-${fornitoreNome}`
    localStorage.setItem(dismissedKey, 'true')
    setDismissed(true)
    setShow(false)
  }

  const scrollToAudit = () => {
    const historySection = document.getElementById('rekki-price-history-scanner')
    if (historySection) {
      historySection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      historySection.classList.add('ring-2', 'ring-cyan-500/40')
      setTimeout(() => historySection.classList.remove('ring-2', 'ring-cyan-500/40'), 2000)
    }
  }

  if (dismissed || !show || !gmailStatus) return null

  return (
    <div className="mb-5 rounded-xl border border-gradient-to-r from-cyan-500/30 to-blue-500/30 bg-gradient-to-br from-cyan-500/10 via-blue-500/10 to-purple-500/10 p-4 shadow-lg backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 ring-2 ring-cyan-500/40">
          <svg className="h-5 w-5 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-cyan-200">{t.appStrings.gmailBadgeTitle}</h4>
          <p className="mt-1 text-xs leading-relaxed text-cyan-200/80">
            {gmailStatus.configured ? (
              <>
                {t.appStrings.gmailBadgeDescConfigured.split('{nome}')[0]}
                <span className="font-semibold text-cyan-100">{fornitoreNome}</span>
                {t.appStrings.gmailBadgeDescConfigured.split('{nome}')[1]}
              </>
            ) : (
              <>
                {t.appStrings.gmailBadgeDescNotConfigured.split('{nome}')[0]}
                <span className="font-semibold text-cyan-100">{fornitoreNome}</span>
                {t.appStrings.gmailBadgeDescNotConfigured.split('{nome}')[1]}
              </>
            )}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={scrollToAudit}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:from-cyan-500 hover:to-blue-500 hover:shadow-lg hover:shadow-cyan-500/25"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {gmailStatus.configured ? t.appStrings.gmailBadgeCTAConnect : t.appStrings.gmailBadgeCTASetup}
            </button>

            <Link
              href="/impostazioni"
              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/20"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {t.nav.impostazioni}
            </Link>

            <button
              type="button"
              onClick={handleDismiss}
              className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-cyan-300/60 transition-colors hover:text-cyan-200"
            >
              {t.appStrings.gmailBadgeDismiss}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/10 text-cyan-300/60 transition-colors hover:bg-cyan-500/20 hover:text-cyan-200"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {gmailStatus.configured && !gmailStatus.connected && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/40">
              <svg className="h-3 w-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              {t.appStrings.gmailBadgeAPIConfigured}
            </span>
          </div>
          <div className="mx-2 h-0.5 flex-1 bg-gradient-to-r from-emerald-500/40 to-cyan-500/20" />
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500/20 ring-1 ring-cyan-500/40">
              <div className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300">
              {t.appStrings.gmailBadgeConnectAccount}
            </span>
          </div>
        </div>
      )}

      {!gmailStatus.configured && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2 py-1.5 text-center">
            <p className="text-[10px] font-bold text-cyan-200">Auto-Poll</p>
            <p className="text-[9px] text-cyan-300/60">Email/15min</p>
          </div>
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 px-2 py-1.5 text-center">
            <p className="text-[10px] font-bold text-blue-200">{t.appStrings.gmailBadgePriceCheck}</p>
            <p className="text-[9px] text-blue-300/60">{t.appStrings.gmailBadgePriceCheckSub}</p>
          </div>
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 px-2 py-1.5 text-center">
            <p className="text-[10px] font-bold text-purple-200">Recovery</p>
            <p className="text-[9px] text-purple-300/60">{t.appStrings.gmailBadgeRecoverySub}</p>
          </div>
        </div>
      )}
    </div>
  )
}
