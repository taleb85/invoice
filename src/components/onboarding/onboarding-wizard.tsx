'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SedeStep } from './steps/sede-step'
import { EmailStep } from './steps/email-step'
import { FornitoreStep } from './steps/fornitore-step'
import { OperatoreStep } from './steps/operatore-step'
import { CompleteStep } from './steps/complete-step'

export type OnboardingState = {
  currentStep: number
  sedeId: string | null
  sedeNome: string | null
  fornitoreId: string | null
  fornitoreNome: string | null
  operatoreNome: string | null
  skippedEmail: boolean
  skippedFornitore: boolean
  skippedOperatore: boolean
}

type StepMeta = {
  id: string
  title: string
  subtitle: string
  optional: boolean
}

const STEPS: StepMeta[] = [
  { id: 'sede', title: 'Crea la tua sede', subtitle: 'Nome, paese e valuta', optional: false },
  { id: 'email', title: 'Configura email IMAP', subtitle: 'Per ricevere fatture automaticamente', optional: true },
  { id: 'fornitore', title: 'Aggiungi il primo fornitore', subtitle: 'Nome, email e P.IVA', optional: true },
  { id: 'operatore', title: 'Crea un operatore', subtitle: 'Nome e PIN per accesso rapido', optional: true },
  { id: 'complete', title: 'Tutto pronto!', subtitle: 'Smart Pair è configurato', optional: false },
]

const LS_KEY = 'smartpair-onboarding'

const INITIAL_STATE: OnboardingState = {
  currentStep: 0,
  sedeId: null,
  sedeNome: null,
  fornitoreId: null,
  fornitoreNome: null,
  operatoreNome: null,
  skippedEmail: false,
  skippedFornitore: false,
  skippedOperatore: false,
}

function loadState(): OnboardingState {
  if (typeof window === 'undefined') return INITIAL_STATE
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return INITIAL_STATE
    return { ...INITIAL_STATE, ...JSON.parse(raw) }
  } catch {
    return INITIAL_STATE
  }
}

function saveState(state: OnboardingState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}

function clearState() {
  try {
    localStorage.removeItem(LS_KEY)
  } catch { /* ignore */ }
}

export function OnboardingWizard() {
  const router = useRouter()
  const [state, setStateRaw] = useState<OnboardingState>(INITIAL_STATE)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const loaded = loadState()
    setStateRaw(loaded)
    setHydrated(true)
  }, [])

  const setState = useCallback((updater: (prev: OnboardingState) => OnboardingState) => {
    setStateRaw((prev) => {
      const next = updater(prev)
      saveState(next)
      return next
    })
  }, [])

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, currentStep: step }))
  }, [setState])

  const handleComplete = useCallback(() => {
    clearState()
    router.push('/')
    router.refresh()
  }, [router])

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#22d3ee] border-t-transparent" />
      </div>
    )
  }

  const step = state.currentStep
  const totalSteps = STEPS.length

  return (
    <div className="flex min-h-dvh flex-col items-center justify-start px-4 py-8 sm:justify-center">
      <div className="w-full max-w-2xl">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-widest text-[#22d3ee]/60 uppercase">Smart Pair</p>
          <h1 className="mt-1 text-2xl font-bold text-white">Setup guidato</h1>
        </div>

        {/* Step sidebar progress — desktop only */}
        <div className="mb-6 hidden sm:flex items-center justify-center gap-2">
          {STEPS.map((s, i) => {
            const isCompleted = i < step
            const isActive = i === step
            return (
              <div key={s.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => i < step && goToStep(i)}
                  disabled={i >= step}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    isCompleted
                      ? 'bg-emerald-500 text-white cursor-pointer'
                      : isActive
                        ? 'bg-[#22d3ee] text-[#020617]'
                        : 'bg-white/10 text-app-fg-subtle'
                  }`}
                >
                  {isCompleted ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`h-px w-8 transition-colors ${i < step ? 'bg-emerald-500' : 'bg-white/10'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Mobile progress bar */}
        <div className="mb-6 sm:hidden">
          <div className="mb-1.5 flex items-center justify-between text-xs text-app-fg-subtle">
            <span>Passaggio {step + 1} di {totalSteps}</span>
            <span>{STEPS[step]?.title}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[#22d3ee] transition-all duration-500"
              style={{ width: `${((step) / (totalSteps - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Step card */}
        <div className="rounded-2xl border border-[#22d3ee]/20 bg-[#0a192f]/80 p-6 shadow-2xl sm:p-8">
          {/* Step header */}
          {step < totalSteps - 1 && (
            <div className="mb-6">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#22d3ee] text-[10px] font-bold text-[#020617]">
                  {step + 1}
                </span>
                <h2 className="text-lg font-bold text-white">{STEPS[step]?.title}</h2>
                {STEPS[step]?.optional && (
                  <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] text-app-fg-subtle">
                    opzionale
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-app-fg-subtle">{STEPS[step]?.subtitle}</p>
            </div>
          )}

          {/* Step content */}
          {step === 0 && (
            <SedeStep
              onComplete={(sedeId, sedeNome) => {
                setState((prev) => ({ ...prev, sedeId, sedeNome, currentStep: 1 }))
              }}
            />
          )}
          {step === 1 && (
            <EmailStep
              sedeId={state.sedeId!}
              onComplete={() => setState((prev) => ({ ...prev, currentStep: 2 }))}
              onSkip={() => setState((prev) => ({ ...prev, skippedEmail: true, currentStep: 2 }))}
            />
          )}
          {step === 2 && (
            <FornitoreStep
              sedeId={state.sedeId!}
              onComplete={(fornitoreId, fornitoreNome) =>
                setState((prev) => ({ ...prev, fornitoreId, fornitoreNome, currentStep: 3 }))
              }
              onSkip={() => setState((prev) => ({ ...prev, skippedFornitore: true, currentStep: 3 }))}
            />
          )}
          {step === 3 && (
            <OperatoreStep
              sedeId={state.sedeId!}
              onComplete={(operatoreNome) =>
                setState((prev) => ({ ...prev, operatoreNome, currentStep: 4 }))
              }
              onSkip={() => setState((prev) => ({ ...prev, skippedOperatore: true, currentStep: 4 }))}
            />
          )}
          {step === 4 && (
            <CompleteStep
              sedeNome={state.sedeNome}
              fornitoreNome={state.fornitoreNome}
              operatoreNome={state.operatoreNome}
              onDone={handleComplete}
            />
          )}
        </div>
      </div>
    </div>
  )
}
