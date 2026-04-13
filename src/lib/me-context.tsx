'use client'

/**
 * UserContext — fetcha /api/me UNA SOLA VOLTA per l'intera sessione dell'app
 * ed espone i dati a tutti i componenti figli tramite useMe().
 *
 * Sostituisce le chiamate individuali a /api/me in Sidebar, ScanEmailButton,
 * use-sede.ts e altri consumer, riducendo le richieste di rete da N a 1.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export interface MeData {
  user:         { id: string; email: string } | null
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

const DEFAULT_ME: MeData = {
  user:         null,
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

const MeContext = createContext<MeContextValue>({
  me:      null,
  loading: true,
  refresh: () => {},
})

export function UserProvider({
  children,
  initialMe = null,
}: {
  children: ReactNode
  /** Da Server Component: stesso payload di `/api/me`, evita flash dock/padding in attesa del fetch. */
  initialMe?: MeData | null
}) {
  const [me, setMe] = useState<MeData | null>(() => initialMe ?? null)
  const [loading, setLoading] = useState(() => initialMe == null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (tick > 0) setLoading(true)
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) {
          setMe(DEFAULT_ME)
          return
        }
        const raw = String(data.role ?? '').toLowerCase()
        const role: MeData['role'] | null =
          raw === 'admin'
            ? 'admin'
            : raw === 'admin_sede'
              ? 'admin_sede'
              : raw === 'operatore'
                ? 'operatore'
                : null
        const isAdmin = !!data.is_admin || role === 'admin'
        const isAdminSede = !!data.is_admin_sede || role === 'admin_sede'
        setMe({
          user: data.user ?? null,
          role,
          sede_id: data.sede_id ?? null,
          sede_nome: data.sede_nome ?? null,
          country_code: data.country_code ?? 'UK',
          currency: data.currency ?? 'GBP',
          timezone: data.timezone ?? 'Europe/London',
          is_admin: isAdmin,
          is_admin_sede: isAdminSede,
          all_sedi: data.all_sedi ?? [],
        })
      })
      .catch(() => setMe(DEFAULT_ME))
      .finally(() => setLoading(false))
  }, [tick])

  const refresh = () => setTick((n) => n + 1)

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
