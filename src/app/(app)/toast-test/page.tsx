'use client'

import Link from 'next/link'
import { useToast } from '@/lib/toast-context'
import { APP_SHELL_SECTION_PAGE_STACK_CLASS } from '@/lib/app-shell-layout'

/** Test lettura sulla barra `#app-desktop-header-nav-progress` (desktop) e toast mobile. */
export default function ToastTestPage() {
  const { showToast } = useToast()

  const longSample =
    'Messaggio lungo da prova leggibilità: 113 documenti in attesa · 4 errori di sincronizzazione IMAP sulle ultime 24 ore · Ricorda di verificare gli estratti conto in sospeso.'

  return (
    <div className={APP_SHELL_SECTION_PAGE_STACK_CLASS}>
      <div className="max-w-xl space-y-4">
        <h1 className="app-page-title text-lg font-semibold leading-snug text-app-fg">Prova notifiche (toast)</h1>
        <p className="text-sm leading-relaxed text-app-fg-muted">
          Su larghezza <strong className="text-app-fg">&ge;768px</strong> il messaggio viene mostrato sulla barra in alto sopra il contenuto ({' '}
          <code className="rounded bg-black/25 px-1 py-px text-[11px]">#app-desktop-header-nav-progress</code>
          ); sotto quel breakpoint compare il toast flottante.
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="inline-flex shrink-0 items-center rounded-lg border border-emerald-500/40 bg-emerald-950/35 px-3 py-2 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-900/45"
            onClick={() => showToast(longSample, 'success')}
          >
            Toast success (+ testo lungo)
          </button>
          <button
            type="button"
            className="inline-flex shrink-0 items-center rounded-lg border border-red-400/35 bg-red-950/35 px-3 py-2 text-xs font-semibold text-red-100 transition-colors hover:bg-red-950/55"
            onClick={() => showToast('Errore simulato: connessione IMAP temporaneamente non disponibile.', 'error')}
          >
            Toast errore (breve)
          </button>
          <button
            type="button"
            className="inline-flex shrink-0 items-center rounded-lg border border-app-line-35 app-workspace-inset-bg px-3 py-2 text-xs font-semibold text-app-fg transition-colors hover:bg-app-line-12"
            onClick={() => showToast('Info: nessuna operazione pendente sulla coda OCR.', 'info')}
          >
            Toast info
          </button>
        </div>

        <Link href="/" className="inline-block text-sm font-medium text-cyan-300/90 underline decoration-cyan-500/45 underline-offset-2 hover:text-cyan-200">
          ← Torna alla dashboard
        </Link>
      </div>
    </div>
  )
}
