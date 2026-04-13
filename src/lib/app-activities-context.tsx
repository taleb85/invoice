'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type AppActivity = { id: string; label: string }

type Ctx = {
  activities: AppActivity[]
  setActivity: (id: string, label: string | null) => void
}

const AppActivitiesContext = createContext<Ctx | null>(null)

export function AppActivitiesProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<Record<string, string>>({})

  const setActivity = useCallback((id: string, label: string | null) => {
    setMap((m) => {
      const next = { ...m }
      if (label === null || label === '') delete next[id]
      else next[id] = label
      return next
    })
  }, [])

  const activities = useMemo(
    () =>
      Object.entries(map)
        .map(([id, label]) => ({ id, label }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    [map],
  )

  const value = useMemo(() => ({ activities, setActivity }), [activities, setActivity])

  return <AppActivitiesContext.Provider value={value}>{children}</AppActivitiesContext.Provider>
}

export function useAppActivities() {
  const ctx = useContext(AppActivitiesContext)
  if (!ctx) throw new Error('useAppActivities must be used within AppActivitiesProvider')
  return ctx
}

export function useAppActivitiesOptional() {
  return useContext(AppActivitiesContext)
}
