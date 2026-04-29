/**
 * Service worker PWA (solo produzione). In sviluppo non va registrato: vedi `PWARegister` + `use-service-worker-update.ts`.
 *
 * Bump quando cambi strategia cache — activate pulisce le vecchie.
 */
const CACHE_NAME = 'fluxo-v7'
const OFFLINE_URL = '/offline'

// API routes to cache with NetworkFirst strategy (fallback to cache when offline)
// /api/me NON in lista: sessione/ruolo devono essere sempre freschi (evita UI «gestionale» con dati vecchi in PWA).
const API_CACHE_NAME = 'fluxo-api-v3'
const API_CACHE_ROUTES = {
  '/api/fornitori': 30 * 60,        // 30 minutes
  '/api/bolle-aperte': 5 * 60,      // 5 minutes
}

// Asset statici da pre-cachare all'installazione (no `/` — la shell app è auth e cambia spesso; la navigazione usa solo rete)
const PRECACHE_URLS = [
  '/offline',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// Install: pre-cacha le risorse essenziali, poi forza l’attivazione del nuovo SW così
// `controllerchange` / UpdatePrompt possono portare l’utente all’ultima build senza restare su JS vecchio.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// Message: handle SKIP_WAITING from UpdatePrompt
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Activate: rimuove cache vecchie
self.addEventListener('activate', (event) => {
  const VALID_CACHES = [CACHE_NAME, API_CACHE_NAME]
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !VALID_CACHES.includes(k)).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: strategia ibrida
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Sviluppo locale: non intercettare (evita schermata «offline» quando il dev server va in timeout / riavvio)
  const h = url.hostname
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost')) {
    return
  }

  /** Mutazioni (DELETE, POST, ecc.): sempre rete diretta senza intermedi (evita 405/body vuoti in PWA). */
  if (request.method !== 'GET') {
    event.respondWith(fetch(request))
    return
  }

  // Ignora origini esterne (es. ipapi.co, Supabase auth, analytics, ecc.)
  // Il SW gestisce solo risorse della stessa origine per evitare log ridondanti
  if (url.origin !== self.location.origin) return

  // API routes → NetworkFirst with selective caching for read-heavy endpoints
  if (url.pathname.startsWith('/api/')) {
    const cacheable = Object.keys(API_CACHE_ROUTES).some((p) => url.pathname === p)

    if (cacheable && request.method === 'GET') {
      // NetworkFirst with cache fallback
      event.respondWith(
        fetch(request)
          .then(async (networkRes) => {
            if (networkRes.ok) {
              const clone = networkRes.clone()
              const cache = await caches.open(API_CACHE_NAME)
              cache.put(request, clone)
            }
            return networkRes
          })
          .catch(async () => {
            const cached = await caches.match(request, { cacheName: API_CACHE_NAME })
            if (cached) return cached
            return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
              headers: { 'Content-Type': 'application/json' },
              status: 503,
            })
          })
      )
      return
    }

    // Non-cacheable API routes → network only, offline fallback JSON
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          headers: { 'Content-Type': 'application/json' },
          status: 503,
        })
      )
    )
    return
  }

  // Navigazione → solo rete (non cacheare HTML autenticato: evita risposte stale tipo /login su URL app)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) ?? Response.error())
    )
    return
  }

  // Assets statici → Cache first, poi network
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
          }
          return res
        })
    )
  )
})

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Smart Pair', {
      body: data.body,
      icon: data.icon ?? '/icons/icon-192.png',
      badge: data.badge ?? '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data?.url ?? '/')
  )
})
