/**
 * Cache locale (IndexedDB) per liste anagrafiche — resilienza a micro-interruzioni.
 * Namespace per sede evita mismatch tra admin/operatore.
 */

const DB = 'fluxo-app-cache'
const DB_VER = 1
const STORE = 'kv'

type FornitoriCachePayload = {
  v: 1
  updatedAt: number
  sedeScope: string
  fornitori: unknown[]
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, DB_VER)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
  })
}

async function idbGet<T>(key: string): Promise<T | null> {
  if (typeof indexedDB === 'undefined') return null
  try {
    const db = await openDb()
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const st = tx.objectStore(STORE)
      const g = st.get(key)
      g.onerror = () => reject(g.error)
      g.onsuccess = () => resolve((g.result as T) ?? null)
    })
  } catch {
    return null
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const st = tx.objectStore(STORE)
      const p = st.put(value, key)
      p.onerror = () => reject(p.error)
      p.onsuccess = () => resolve()
    })
  } catch {
    /* ignore quota / private mode */
  }
}

const keyFornitori = (sedeScope: string) => `fornitori:${sedeScope}`

export async function cacheFornitoriList(sedeScope: string, fornitori: unknown[]): Promise<void> {
  const payload: FornitoriCachePayload = {
    v: 1,
    updatedAt: Date.now(),
    sedeScope,
    fornitori,
  }
  await idbSet(keyFornitori(sedeScope), payload)
}

export async function readCachedFornitoriList(sedeScope: string): Promise<unknown[] | null> {
  const raw = await idbGet<FornitoriCachePayload>(keyFornitori(sedeScope))
  if (!raw || raw.v !== 1 || !Array.isArray(raw.fornitori)) return null
  return raw.fornitori
}
