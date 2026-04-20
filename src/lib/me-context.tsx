'use client'

/**
 * UserContext — fetches /api/me once per session via SWR.
 *
 * SWR deduplication ensures only one in-flight request regardless of
 * how many components call useMe(). The dedupingInterval prevents
 * re-fetches within a 30 s window; fallbackData provides instant
 * hydration from the SSR payload so there is no loading flash.
 */

import { createContext, useContext, useCallback, type ReactNode } from 'react'
import useSWR, { mutate as globalMutate } from 'swr'

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
}

interface MeContextValue {
  me:      MeData | null
  loading: boolean
  /** Forza un re-fetch (es. dopo il cambio sede) */
  refresh: () => void
}

export const ME_SWR_KEY = '/api/me'

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
  }
}

const meFetcher = (url: string): Promise<MeData | null> =>
  fetch(url).then((r) => (r.ok ? r.json().then(parseMeResponse) : null))

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
      revalidateOnFocus:    false,
      revalidateOnReconnect: true,
      dedupingInterval:     30_000,
      // Provide SSR data immediately; SWR revalidates in the background
      fallbackData:         initialMe ?? undefined,
    },
  )

  // data === null means a non-ok response (401/404) — fall back to initialMe
  const me = data === null ? (initialMe ?? null) : (data ?? null)
  const loading = isLoading && me === null

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
