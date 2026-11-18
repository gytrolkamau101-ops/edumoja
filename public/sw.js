/* EduMoja v14 service worker — smooth app shell, never cache auth/API */
const CACHE = 'edumoja-shell-v15'
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/logo-c2.jpg',
  '/offline.html',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

function isApiOrAuth(url) {
  const h = url.hostname || ''
  if (
    h.includes('supabase') ||
    h.includes('intasend') ||
    h.includes('sentry') ||
    h.includes('google') ||
    h.includes('gstatic') ||
    h.includes('googleapis')
  ) {
    return true
  }
  const p = url.pathname || ''
  if (p.startsWith('/api/') || p.startsWith('/.netlify/functions/')) return true
  return false
}

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false
  const p = url.pathname
  return (
    p.startsWith('/assets/') ||
    /\.(js|css|woff2?|png|jpg|jpeg|svg|webp|ico|webmanifest)$/i.test(p)
  )
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch (_) {
    return
  }

  if (isApiOrAuth(url)) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => {
              c.put('/index.html', copy).catch(() => {})
            })
          }
          return res
        })
        .catch(() =>
          caches.match('/index.html').then((r) => r || caches.match('/offline.html'))
        )
    )
    return
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetching = fetch(request)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(request, copy).catch(() => {}))
            }
            return res
          })
          .catch(() => cached)
        return cached || fetching
      })
    )
    return
  }

  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy).catch(() => {}))
          }
          return res
        })
        .catch(() => caches.match(request))
    )
  }
})
