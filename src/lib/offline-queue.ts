export type OfflineAction = {
  id: string
  type: 'bolla.create' | 'fattura.create' | 'documento.discard'
  payload: Record<string, unknown>
  fileData?: string  // base64-encoded data URL
  fileType?: string
  createdAt: string
  retries: number
}

const DB_NAME = 'smart-pair-offline'
const STORE_NAME = 'pending-actions'
const DB_VERSION = 1

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function queueAction(
  action: Omit<OfflineAction, 'id' | 'createdAt' | 'retries'>,
): Promise<string> {
  const db = await openDB()
  const id = crypto.randomUUID()
  const full: OfflineAction = {
    ...action,
    id,
    createdAt: new Date().toISOString(),
    retries: 0,
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).add(full)
    tx.oncomplete = () => resolve(id)
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingActions(): Promise<OfflineAction[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve((req.result as OfflineAction[]) ?? [])
    req.onerror = () => reject(req.error)
  })
}

export async function removeAction(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function incrementRetries(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(id)
    req.onsuccess = () => {
      const action = req.result as OfflineAction | undefined
      if (action) {
        action.retries++
        store.put(action)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getPendingCount(): Promise<number> {
  const actions = await getPendingActions()
  return actions.length
}
