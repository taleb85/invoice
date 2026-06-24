'use client'

import { useState, useEffect, useId } from 'react'
import { useLocale } from '@/lib/locale-context'
import { type SollecitiReminderSettings } from '@/lib/sollecito-aging'
import { fetchSollecitiSettingsAction } from '@/app/(app)/settings/solleciti/actions'
import SollecitiSettingsClient from '@/app/(app)/settings/solleciti/solleciti-settings-client'

/** Soglie e automazione solleciti (admin / admin sede), inline nel cassetto. */
export function SollecitiSettingsLinkCard() {
  const { t } = useLocale()
  const imp = t.impostazioni
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sollecitiInitial, setSollecitiInitial] = useState<SollecitiReminderSettings | null>(null)
  const [embeddedSession, setEmbeddedSession] = useState(0)
  const uid = useId()
  const toggleId = `imp-solleciti-toggle-${uid}`
  const panelId = `imp-solleciti-panel-${uid}`

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchSollecitiSettingsAction()
        if (!cancelled) setSollecitiInitial(data)
      } catch {
        if (!cancelled) setSollecitiInitial(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [embeddedSession])

  const reloadSollecitiAfterSave = (saved: SollecitiReminderSettings) => {
    setSollecitiInitial(saved)
    setEmbeddedSession((n) => n + 1)
  }

  return (
    <div className="app-card min-h-0 min-w-0 overflow-hidden">
      <div className="app-workspace-inset-bg-soft p-5">
        <button
          type="button"
          id={toggleId}
          aria-expanded={drawerOpen}
          aria-controls={drawerOpen ? panelId : undefined}
          aria-label={drawerOpen ? imp.linkSollecitiDrawerAriaClose : imp.linkSollecitiDrawerAriaOpen}
          onClick={() => setDrawerOpen((v) => !v)}
          className="flex w-full min-w-0 touch-manipulation items-start gap-4 rounded-xl text-left outline-none ring-app-cyan-500/40 transition hover:bg-black/[0.06] focus-visible:ring-2"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/12 ring-1 ring-amber-500/25">
            <svg className="h-5 w-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-app-fg-muted">{imp.linkSolleciti}</p>
            <p className="mt-1 text-xs leading-snug text-app-fg-muted">{imp.linkSollecitiDesc}</p>
            {!drawerOpen ? (
              <p className="mt-1.5 text-xs leading-snug text-app-fg-muted">{imp.linkSollecitiDrawerCollapsedHint}</p>
            ) : null}
          </div>
          <svg
            className={`mt-2 h-5 w-5 shrink-0 text-app-fg-muted transition-transform duration-200 ${drawerOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      {drawerOpen ? (
        <div
          id={panelId}
          role="region"
          aria-label={`${imp.linkSolleciti} — ${t.sollecitiSettingsPage.title}`}
          className="border-t border-app-line-30 app-workspace-inset-bg-soft p-4 sm:p-5"
        >
          {sollecitiInitial === null ? (
            <p className="text-xs leading-relaxed text-app-fg-muted">{t.common.loading}</p>
          ) : (
            <SollecitiSettingsClient
              key={`imp-sol-embed-${embeddedSession}`}
              variant="embedded"
              initial={sollecitiInitial}
              onPersisted={reloadSollecitiAfterSave}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}
