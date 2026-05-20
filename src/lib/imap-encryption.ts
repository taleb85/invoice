import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Decifra una password IMAP. Se la password è in chiaro (legacy, non cifrata),
 * la restituisce così com'è. Non richiede modifiche alle query esistenti.
 *
 * Cache di sessione: evita chiamate RPC ripetute per la stessa password.
 */
const decryptCache = new Map<string, string>()

export async function decryptImapPassword(
  supabase: SupabaseClient,
  encryptedOrPlain: string | null | undefined,
): Promise<string | null> {
  if (!encryptedOrPlain) return null

  const cached = decryptCache.get(encryptedOrPlain)
  if (cached !== undefined) return cached

  // È in chiaro? (non sembra hex cifrato)
  const trimmed = encryptedOrPlain.trim()
  const looksEncrypted = /^[0-9a-f]+$/i.test(trimmed) && trimmed.length > 40
  if (!looksEncrypted) {
    decryptCache.set(encryptedOrPlain, trimmed)
    return trimmed
  }

  try {
    const { data, error } = await supabase.rpc('imap_decrypt', {
      ciphertext: trimmed,
    })
    if (!error && data) {
      const decrypted = String(data)
      decryptCache.set(encryptedOrPlain, decrypted)
      return decrypted
    }
  } catch {
    // Fallback: restituisci il valore così com'è
  }

  decryptCache.set(encryptedOrPlain, trimmed)
  return trimmed
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
  return passwords.map(p => (p ? map.get(p) ?? p : null))
}
