import { createBrowserClient } from '@supabase/ssr'

// Singleton: una sola istanza del browser client per tutta la SPA
// per garantire che lo stato di sessione in-memory non venga perso tra re-render
let _client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (typeof window === 'undefined') {
    // SSR: nuova istanza per ogni request
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  return _client
}
