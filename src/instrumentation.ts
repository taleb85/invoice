/**
 * Eseguito una volta all’avvio del server Node (dev / start).
 * Avvisa in console se mancano variabili essenziali per OCR e Supabase.
 */
export async function register() {
  if (process.env.NODE_ENV !== 'development') return
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const missing: string[] = []
  if (!process.env.OPENAI_API_KEY?.trim()) missing.push('OPENAI_API_KEY')
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  if (!missing.length) return

  const lines = missing.map((k) => `  • ${k}`).join('\n')
  console.warn(
    '\n[ENV] Attenzione — variabili mancanti o vuote (.env locale):\n' +
      lines +
      '\n  Alcune funzioni (OCR, auth, sync) potrebbero non funzionare.\n'
  )

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.warn(
      '[ENV] SUPABASE_SERVICE_ROLE_KEY mancante: route server-side (es. scan email, service client) potrebbero non funzionare.\n'
    )
  }
}
