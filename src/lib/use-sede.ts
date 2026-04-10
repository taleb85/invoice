/**
 * Hook che restituisce sede_id e role dell'utente corrente.
 * Legge dal UserContext (un solo fetch /api/me per l'intera sessione),
 * invece di fare una nuova chiamata HTTP per ogni consumer.
 */
import { useMe } from '@/lib/me-context'

export function useSedeId() {
  const { me, loading } = useMe()
  return {
    sedeId: me?.sede_id ?? null,
    role:   me?.role    ?? null,
    ready:  !loading,
  }
}
