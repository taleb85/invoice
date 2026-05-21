import type { SupabaseClient } from '@supabase/supabase-js'

/** TTL per le password decifrate in cache (5 minuti). Limita l'esposizione in worker caldi. */
const DECRYPT_CACHE_TTL_MS = 5 * 60 * 1000

type CacheEntry = {
  value: string
  /** Timestamp Unix (ms) oltre il quale la voce è scaduta. */
  expiresAt: number
}

/**
 * Cache di sessione con TTL: evita chiamate RPC ripetute per la stessa password durante
 * un singolo ciclo di sync, ma svuota le voci dopo 5 minuti per evitare che le password
 * decifrate persistano tra richieste multi-tenant in container serverless caldi.
 */
const decryptCache = new Map<string, CacheEntry>()

function getCached(key: string): string | undefined {
  const entry = decryptCache.get(key)
  if (!entry) return undefined
  if (Date.now() > entry.expiresAt) {
    decryptCache.delete(key)
    return undefined
  }
  return entry.value
}

function setCached(key: string, value: string): void {
  decryptCache.set(key, { value, expiresAt: Date.now() + DECRYPT_CACHE_TTL_MS })
}

/**
 * Svuota manualmente la cache (da chiamare a fine ciclo di sync per eliminare
 * le credenziali decifrate prima che il worker resti caldo per la prossima richiesta).
 */
export function clearImapDecryptCache(): void {
  decryptCache.clear()
}

/**
 * Decifra una password IMAP. Se la password è in chiaro (legacy, non cifrata),
 * la restituisce così com'è. Non richiede modifiche alle query esistenti.
 *
 * In caso di errore RPC (chiave mancante, ciphertext corrotto), logga un errore
 * critico e restituisce null invece di fare un pass-through silenzioso del ciphertext.
 */
export async function decryptImapPassword(
  supabase: SupabaseClient,
  encryptedOrPlain: string | null | undefined,
): Promise<string | null> {
  if (!encryptedOrPlain) return null

  const cached = getCached(encryptedOrPlain)
  if (cached !== undefined) return cached

  const trimmed = encryptedOrPlain.trim()

  // Heuristica: valore non cifrato (non è hex puro di lunghezza >40)
  const looksEncrypted = /^[0-9a-f]+$/i.test(trimmed) && trimmed.length > 40
  if (!looksEncrypted) {
    setCached(encryptedOrPlain, trimmed)
    return trimmed
  }

  try {
    const { data, error } = await supabase.rpc('imap_decrypt', {
      ciphertext: trimmed,
    })
    if (!error && data) {
      const decrypted = String(data)
      setCached(encryptedOrPlain, decrypted)
      return decrypted
    }
    // Errore RPC esplicito: non fare pass-through del ciphertext grezzo
    const reason = error?.message ?? 'risposta vuota'
    console.error(
      '[IMAP] Errore critico decifrazione IMAP: verificare chiave di cifratura dell\'applicazione.',
      { reason },
    )
    return null
  } catch (err) {
    console.error(
      '[IMAP] Errore critico decifrazione IMAP: verificare chiave di cifratura dell\'applicazione.',
      err,
    )
    return null
  }
}

/**
 * Versione batch: decifra più password contemporaneamente.
 */
export async function decryptImapPasswords(
  supabase: SupabaseClient,
  passwords: (string | null | undefined)[],
): Promise<(string | null)[]> {
  const unique = [...new Set(passwords.filter((p): p is string => !!p))]
  const results = await Promise.all(
    unique.map(p => decryptImapPassword(supabase, p)),
  )
  const map = new Map<string, string | null>()
  for (let i = 0; i < unique.length; i++) {
    map.set(unique[i], results[i])
  }
  return passwords.map(p => (p ? (map.has(p) ? map.get(p)! : null) : null))
}
