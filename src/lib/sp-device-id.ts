/** Id dispositivo persistente (PWA / operatore). */
export const SP_DEVICE_ID_KEY = 'sp_device_id'

export function getOrCreateSpDeviceId(): string {
  try {
    let id = localStorage.getItem(SP_DEVICE_ID_KEY)?.trim()
    if (id) return id
    id = crypto.randomUUID()
    localStorage.setItem(SP_DEVICE_ID_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

export function readSpDeviceId(): string | null {
  try {
    const id = localStorage.getItem(SP_DEVICE_ID_KEY)?.trim()
    return id || null
  } catch {
    return null
  }
}

export function clearSpDeviceId(): void {
  try {
    localStorage.removeItem(SP_DEVICE_ID_KEY)
  } catch {
    /* ignore */
  }
}
