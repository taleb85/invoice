const CACHE_NAME = 'fluxo-v2'
const OFFLINE_URL = '/offline'

// Asset statici da pre-cachare all'installazione
const PRECACHE_URLS = [
  '/',
  '/offline',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

// Install: pre-cacha le risorse essenziali
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

// Activate: rimuove cache vecchie
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch: strategia ibrida
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignora richieste non-GET
  if (request.method !== 'GET') return

  // Ignora origini esterne (es. ipapi.co, Supabase auth, analytics, ecc.)
  // Il SW gestisce solo risorse della stessa origine per evitare log ridondanti
  if (url.origin !== self.location.origin) return

  // API routes → Network first, fallback offline
  if (url.pathname.startsWith('/api/')) {
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
