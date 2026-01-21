/// <reference lib="webworker" />

const CACHE_NAME = 'mimebookmark-v1';
const OFFLINE_URL = '/offline';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// API routes to cache with network-first strategy (empty - authenticated endpoints should not be cached)
const API_CACHE_PATTERNS = [];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // API requests - never cache, always fetch directly
  if (url.pathname.startsWith('/api/') || API_CACHE_PATTERNS.some(pattern => url.pathname.startsWith(pattern))) {
    event.respondWith(
      fetch(request).catch((error) => {
        console.error('Service Worker: API request failed:', error);
        return new Response(JSON.stringify({ error: 'Service Unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Static assets - cache first, fall back to network
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // HTML pages - network first with cache fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Default - network first
  event.respondWith(networkFirst(request));
});

// Cache-first strategy for static assets
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// Network-first strategy for API and HTML
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Return offline page for HTML requests
    if (request.headers.get('accept')?.includes('text/html')) {
      const offlinePage = await caches.match(OFFLINE_URL);
      return offlinePage || new Response('Offline', { status: 503 });
    }

    return new Response('Offline', { status: 503 });
  }
}

// Check if the request is for a static asset
function isStaticAsset(pathname) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
  return staticExtensions.some(ext => pathname.endsWith(ext));
}

// Background sync for offline bookmark operations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-bookmarks') {
    event.waitUntil(syncBookmarks());
  }
});

async function syncBookmarks() {
  // Get pending operations from IndexedDB
  // This would sync any offline bookmark creations/updates
  console.log('Syncing bookmarks...');
}

// Push notifications for recommendations
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    // Validate required fields
    if (!data || !data.title || data.title.trim() === '') {
      console.warn('Push notification missing required title field');
      return;
    }

    const options = {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: data.tag || 'default',
      data: data.url || null
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  } catch (error) {
    console.error('Failed to parse push notification data:', error);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.notification.data) {
    event.waitUntil(
      (async () => {
        try {
          // Validate and sanitize the URL
          const url = new URL(event.notification.data, self.location.origin);

          // Only allow same-origin URLs
          if (url.origin === self.location.origin) {
            await self.clients.openWindow(url.href);
          } else {
            // Fallback to home page for cross-origin URLs
            await self.clients.openWindow('/');
          }
        } catch (error) {
          // If URL parsing fails, open home page
          console.warn('Invalid notification URL:', error);
          await self.clients.openWindow('/');
        }
      })()
    );
  }
});

// Message handling for communication with main thread
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CACHE_URLS') {
    event.waitUntil(
      (async () => {
        try {
          const urls = event.data.urls;
          if (!Array.isArray(urls) || urls.length === 0) {
            return;
          }

          // Validate and sanitize URLs - only allow same-origin URLs
          const validUrls = [];
          for (const url of urls) {
            try {
              const parsedUrl = new URL(url, self.location.href);
              if (parsedUrl.origin === self.location.origin) {
                validUrls.push(parsedUrl.href);
              } else {
                console.warn('SW: Rejecting cross-origin cache URL:', url);
              }
            } catch (e) {
              console.warn('SW: Invalid URL for caching:', url, e);
            }
          }

          if (validUrls.length > 0) {
            const cache = await caches.open(CACHE_NAME);
            await cache.addAll(validUrls);
          }
        } catch (error) {
          console.error('SW: Failed to cache URLs:', error);
        }
      })()
    );
  }
});
