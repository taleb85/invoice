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
  role:         'admin' | 'operatore' | null
  sede_id:      string | null
  sede_nome:    string | null
  country_code: string
  is_admin:     boolean
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
  is_admin:     false,
  all_sedi:     [],
}

const MeContext = createContext<MeContextValue>({
  me:      null,
  loading: true,
  refresh: () => {},
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [me, setMe]           = useState<MeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick]       = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) { setMe(DEFAULT_ME); return }
        setMe({
          user:         data.user         ?? null,
          role:         data.role         ?? null,
          sede_id:      data.sede_id      ?? null,
          sede_nome:    data.sede_nome    ?? null,
          country_code: data.country_code ?? 'UK',
          is_admin:     !!data.is_admin,
          all_sedi:     data.all_sedi     ?? [],
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
