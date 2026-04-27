'use client'

/**
 * UserContext — fetches /api/me once per session via SWR.
 *
 * SWR deduplication ensures only one in-flight request regardless of
 * how many components call useMe(). The dedupingInterval prevents
 * re-fetches within a 30 s window; fallbackData provides instant
 * hydration from the SSR payload so there is no loading flash.
 */

import { createContext, useContext, useCallback, useEffect, type ReactNode } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'
import { isInvalidRefreshTokenError } from '@/lib/auth-refresh-error'
import { createClient } from '@/utils/supabase/client'

export interface MeData {
  user:         { id: string; email: string } | null
  /** `profiles.full_name` — nome mostrato in UI (es. sidebar) quando non c'è operatore attivo nel contesto */
  full_name:    string | null
  role:         'admin' | 'admin_sede' | 'operatore' | null
  sede_id:      string | null
  sede_nome:    string | null
  country_code: string
  /** ISO 4217 currency code from the active sede (e.g. 'GBP', 'EUR', 'USD') */
  currency:     string
  /** IANA timezone for the active sede (e.g. 'Europe/London') */
  timezone:     string
  /** Admin Master (tutte le sedi) */
  is_admin:     boolean
  /** Responsabile di sede: permessi elevati solo su `sede_id` */
  is_admin_sede: boolean
  all_sedi:     { id: string; nome: string }[]
  /** False only for master admin with zero sedi configured — triggers onboarding */
  onboarding_complete: boolean
}

interface MeContextValue {
  me:      MeData | null
  loading: boolean
  /** Forza un re-fetch (es. dopo il cambio sede) */
  refresh: () => void
}

export const ME_SWR_KEY = '/api/me'

/** Evita schermata "Caricamento…" infinita se /api/me non risponde (rete mobile, tab in background). */
const ME_FETCH_TIMEOUT_MS = 20_000

/**
 * Dopo `ME_FETCH_TIMEOUT_MS` SWR potrebbe ancora segnalare isLoading in casi rari; se restiamo
 * senza `me` oltre questo margine, reindirizza al login invece della splash fissa.
 */
const ME_SESSION_BOOT_SAFETY_MS = ME_FETCH_TIMEOUT_MS + 6_000

/**
 * Dopo `signInWithPassword` il client Supabase può non avere ancora scritto i cookie
 * che la prossima richiesta verso `/api/me` invia. Il login imposta questa chiave; se la
 * prima risposta fallisce (401, altro status, corpo vuoto, timeout), aspettiamo 1s e
 * ritentiamo una sola volta.
 */
export const FLUXO_JUST_AUTHED_KEY = 'fluxo-just-authed'
const FLUXO_JUST_AUTHED_MAX_AGE_MS = 25_000

export function markClientSessionJustEstablished(): void {
  try {
    if (typeof sessionStorage === 'undefined') return
    sessionStorage.setItem(FLUXO_JUST_AUTHED_KEY, String(Date.now()))
  } catch {
    /* private mode, quota */
  }
}

const DEFAULT_ME: MeData = {
  user:         null,
  full_name:    null,
  role:         null,
  sede_id:      null,
  sede_nome:    null,
  country_code: 'UK',
  currency:     'GBP',
  timezone:     'Europe/London',
  is_admin:     false,
  is_admin_sede: false,
  all_sedi:     [],
  onboarding_complete: true,
}

function parseMeResponse(data: Record<string, unknown>): MeData {
  const raw = String(data.role ?? '').toLowerCase()
  const role: MeData['role'] =
    raw === 'admin'
      ? 'admin'
      : raw === 'admin_sede'
        ? 'admin_sede'
        : raw === 'operatore'
          ? 'operatore'
          : null
  return {
    user:          (data.user as MeData['user']) ?? null,
    full_name:     typeof data.full_name === 'string' ? data.full_name.trim() || null : null,
    role,
    sede_id:       (data.sede_id as string) ?? null,
    sede_nome:     (data.sede_nome as string) ?? null,
    country_code:  (data.country_code as string) ?? 'UK',
    currency:      (data.currency as string) ?? 'GBP',
    timezone:      (data.timezone as string) ?? 'Europe/London',
    is_admin:      !!(data.is_admin) || role === 'admin',
    is_admin_sede: !!(data.is_admin_sede) || role === 'admin_sede',
    all_sedi:      (data.all_sedi as MeData['all_sedi']) ?? [],
    onboarding_complete: typeof data.onboarding_complete === 'boolean' ? data.onboarding_complete : true,
  }
}

function clearJustAuthedFlag(): void {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(FLUXO_JUST_AUTHED_KEY)
  } catch { /* ignore */ }
}

function shouldRetry401AfterSignIn(): boolean {
  try {
    if (typeof sessionStorage === 'undefined') return false
    const raw = sessionStorage.getItem(FLUXO_JUST_AUTHED_KEY)
    if (!raw) return false
    const ts = Number(raw)
    if (!Number.isFinite(ts) || Date.now() - ts > FLUXO_JUST_AUTHED_MAX_AGE_MS) {
      clearJustAuthedFlag()
      return false
    }
    return true
  } catch {
    return false
  }
}

const meFetcher = async (url: string, isPostLoginRetry = false): Promise<MeData | null> => {
  const ac = new AbortController()
  const t = window.setTimeout(() => ac.abort(), ME_FETCH_TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(url, {
      cache: 'no-store',
      signal: ac.signal,
    })
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    if (name === 'AbortError') {
      console.warn(`[me] /api/me timed out after ${ME_FETCH_TIMEOUT_MS}ms`)
    }
    window.clearTimeout(t)
    if (!isPostLoginRetry && shouldRetry401AfterSignIn()) {
      clearJustAuthedFlag()
      console.info('[me] /api/me errore/rete subito dopo login — retry tra 1s (cookie sessione in volo)')
      await new Promise((r) => setTimeout(r, 1_000))
      return meFetcher(url, true)
    }
    return null
  }
  window.clearTimeout(t)

  if (res.status === 401) {
    const body = await res.json().catch(() => ({})) as { error?: string; reason?: string }
    if (body.error === 'session_expired') {
      clearJustAuthedFlag()
      const reason =
        body.reason === 'inactivity'
          ? 'Sessione scaduta per inattività'
          : 'Sessione scaduta'
      window.location.href = `/login?expired=1&reason=${encodeURIComponent(reason)}`
      return null
    }
    if (!isPostLoginRetry && shouldRetry401AfterSignIn()) {
      clearJustAuthedFlag()
      console.info('[me] /api/me 401 subito dopo login — retry tra 1s (cookie sessione in volo)')
      await new Promise((r) => setTimeout(r, 1_000))
      return meFetcher(url, true)
    }
    return null
  }

  if (!res.ok) {
    if (!isPostLoginRetry && shouldRetry401AfterSignIn()) {
      clearJustAuthedFlag()
      console.info(`[me] /api/me ${res.status} subito dopo login — retry tra 1s (cookie sessione in volo)`)
      await new Promise((r) => setTimeout(r, 1_000))
      return meFetcher(url, true)
    }
    return null
  }
  const raw = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (raw) {
    clearJustAuthedFlag()
    return parseMeResponse(raw)
  }
  if (!isPostLoginRetry && shouldRetry401AfterSignIn()) {
    clearJustAuthedFlag()
    console.info('[me] /api/me risposta vuota subito dopo login — retry tra 1s (cookie sessione in volo)')
    await new Promise((r) => setTimeout(r, 1_000))
    return meFetcher(url, true)
  }
  return null
}

const MeContext = createContext<MeContextValue>({
  me:      null,
  loading: true,
  refresh: () => {},
})

export function UserProvider({
  children,
  initialMe = null,
}: {
  children:   ReactNode
  /** Da Server Component: stesso payload di `/api/me`, evita flash mentre SWR carica. */
  initialMe?: MeData | null
}) {
  const { data, isLoading, mutate } = useSWR<MeData | null>(
    ME_SWR_KEY,
    meFetcher,
    {
      revalidateOnFocus:     false,
      revalidateOnReconnect: true,
      dedupingInterval:      30_000,
      errorRetryCount:       0,
      // Provide SSR data immediately; SWR revalidates in the background
      fallbackData:          initialMe ?? undefined,
    },
  )

  // data === null means a non-ok response (401/404) — fall back to initialMe
  const me = data === null ? (initialMe ?? null) : (data ?? null)
  const loading = isLoading && me === null

  useEffect(() => {
    const supabase = createClient()
    void (async () => {
      const { error } = await supabase.auth.getSession()
      if (!error || !isInvalidRefreshTokenError(error)) return
      await supabase.auth.signOut({ scope: 'local' })
      const path = window.location.pathname
      if (path === '/login' || path.startsWith('/login/')) return
      try {
        window.location.replace('/login?session=invalid')
      } catch {
        window.location.replace('/login')
      }
    })()
  }, [])

  useEffect(() => {
    if (me) return
    if (!isLoading) return
    const id = window.setTimeout(() => {
      try {
        window.location.replace('/login?session=me_stuck')
      } catch {
        window.location.replace('/login')
      }
    }, ME_SESSION_BOOT_SAFETY_MS)
    return () => window.clearTimeout(id)
  }, [me, isLoading])

  const refresh = useCallback(() => { mutate() }, [mutate])

  return (
    <MeContext.Provider value={{ me, loading, refresh }}>
      {children}
    </MeContext.Provider>
  )
}

/** Hook per leggere i dati dell'utente corrente dal contesto globale. */
export function useMe(): MeContextValue {
  return useContext(MeContext)
}

/**
 * Global helper — call from anywhere after mutations that change the user
 * profile (e.g. sede switch) to immediately revalidate /api/me in all
 * components that share the UserProvider.
 */
export const revalidateMe = () => globalMutate(ME_SWR_KEY)
