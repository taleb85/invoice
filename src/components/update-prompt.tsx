'use client'
import { useServiceWorkerUpdate } from '@/hooks/use-service-worker-update'
import { SplashScreen } from './splash-screen'

export function UpdatePrompt() {
  const { updateAvailable, updating, applyUpdate } = useServiceWorkerUpdate()

  if (updating) {
    return <SplashScreen message="Aggiornamento in corso..." />
  }

  if (!updateAvailable) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[500] flex items-center justify-between gap-3 rounded-2xl border border-[#22d3ee]/30 bg-[#0f2a4a]/95 p-4 shadow-[0_0_30px_rgba(34,211,238,0.15)] backdrop-blur-sm md:bottom-6 md:left-auto md:right-6 md:max-w-sm"
      style={{ animation: 'up-slide 0.3s ease-out' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#22d3ee]/10">
          <svg className="h-4 w-4 text-[#22d3ee]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-white/90">Aggiornamento disponibile</p>
          <p className="text-xs text-white/40">Nuova versione di Smart Pair</p>
        </div>
      </div>
      <button
        onClick={applyUpdate}
        className="shrink-0 rounded-xl bg-[#22d3ee] px-4 py-2 text-xs font-semibold text-[#0a192f] transition-all hover:opacity-90 active:scale-95"
      >
        Aggiorna
      </button>

      <style>{`
        @keyframes up-slide {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
