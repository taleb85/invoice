import { useEffect, useState } from 'react'

/** Hook che restituisce il sede_id e il role dell'utente corrente via API server-side. */
export function useSedeId() {
  const [sedeId, setSedeId] = useState<string | null>(null)
  const [role, setRole] = useState<'admin' | 'operatore' | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setSedeId(data?.sede_id ?? null)
        setRole(data?.role ?? 'operatore')
        setReady(true)
      })
      .catch(() => setReady(true))
  }, [])

  return { sedeId, role, ready }
}
