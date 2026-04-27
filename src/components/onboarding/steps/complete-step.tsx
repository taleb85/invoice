'use client'

type Props = {
  sedeNome: string | null
  fornitoreNome: string | null
  operatoreNome: string | null
  onDone: () => void
}

const TIPS = [
  { icon: '📧', text: 'Sincronizza le email dalla Dashboard per importare le prime fatture automaticamente' },
  { icon: '📸', text: 'Usa il pulsante fotocamera su mobile per registrare bolle e DDT in pochi secondi' },
  { icon: '👤', text: "Il tuo operatore può accedere con il suo nome e PIN dalla schermata di login" },
  { icon: '🔔', text: 'Attiva le notifiche push nelle Impostazioni per ricevere avvisi in tempo reale' },
]

export function CompleteStep({ sedeNome, fornitoreNome, operatoreNome, onDone }: Props) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Animated checkmark */}
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-500/40">
          <svg className="h-10 w-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      </div>

      <h2 className="text-2xl font-bold text-white">Tutto pronto!</h2>
      <p className="mt-1 text-sm text-white/50">{"Smart Pair è configurato e pronto all'uso"}</p>

      {/* Summary */}
      {(sedeNome || fornitoreNome || operatoreNome) && (
        <div className="mt-6 w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">Riepilogo configurazione</p>
          <div className="space-y-2">
            {sedeNome && (
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#22d3ee]/15">
                  <svg className="h-3.5 w-3.5 text-[#22d3ee]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] text-white/40">Sede creata</p>
                  <p className="text-sm font-medium text-white">{sedeNome}</p>
                </div>
              </div>
            )}
            {fornitoreNome && (
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/15">
                  <svg className="h-3.5 w-3.5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] text-white/40">Primo fornitore</p>
                  <p className="text-sm font-medium text-white">{fornitoreNome}</p>
                </div>
              </div>
            )}
            {operatoreNome && (
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15">
                  <svg className="h-3.5 w-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] text-white/40">Operatore creato</p>
                  <p className="text-sm font-medium text-white">{operatoreNome}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick tips */}
      <div className="mt-6 w-full space-y-2 text-left">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">Prossimi passi</p>
        {TIPS.map((tip, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3">
            <span className="mt-px shrink-0 text-base">{tip.icon}</span>
            <p className="text-xs text-white/60">{tip.text}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onDone}
        className="mt-8 w-full rounded-xl bg-[#22d3ee] py-3.5 text-sm font-bold text-[#020617] transition hover:opacity-90 active:scale-[.98]"
      >
        Vai alla Dashboard →
      </button>
    </div>
  )
}
