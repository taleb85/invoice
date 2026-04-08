import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'

/** Hook che restituisce il sede_id e il role dell'utente corrente. */
export function useSedeId() {
  const [sedeId, setSedeId] = useState<string | null>(null)
  const [role, setRole] = useState<'admin' | 'operatore' | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setReady(true); return }
      supabase
        .from('profiles')
        .select('sede_id, role')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setSedeId(data?.sede_id ?? null)
          setRole(data?.role ?? 'operatore')
          setReady(true)
        })
    })
  }, [])

  return { sedeId, role, ready }
}
