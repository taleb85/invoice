/**
 * Ricarico “duro”: navigazione completa alla home (`/` non via client router).
 * Elimina tutte le voci della Cache Storage controllabile dall’origine (bundle PWA / API in cache SW).
 *
 * Non tocca cronologia né cache HTTP fuori dall’API `caches` (browser non espone dalla pagina).
 */
export async function hardNavigateHomeClearCaches(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((name) => caches.delete(name)))
    }
  } catch {
    /* best-effort */
  }
  window.location.assign('/')
}
