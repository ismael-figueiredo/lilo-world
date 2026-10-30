// Keeps what was already played on the device, so the game opens without a network.
const CACHE = 'lilo-world-v1';

const isSameOrigin = (url) => new URL(url).origin === self.location.origin;

// Servers send "Vary: Origin": without this, a stored module script is never found.
const lookup = { ignoreVary: true };

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

// The first visit starts before this worker: the page lists what it already fetched.
self.addEventListener('message', (event) => {
  const urls = event.data?.remember;
  if (!Array.isArray(urls)) return;
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(urls.filter(isSameOrigin).map((url) => cache.add(url)))),
  );
});

async function fresh(request, cache) {
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

/** The newest page when online; what is stored otherwise. */
async function networkFirst(request, cache) {
  try {
    return await fresh(request, cache);
  } catch (error) {
    const stored = await cache.match(request, { ...lookup, ignoreSearch: true });
    if (stored !== undefined) return stored;
    throw error;
  }
}

/** Answers at once from what is stored and updates it for the next visit. */
async function storedFirst(request, cache) {
  const stored = await cache.match(request, lookup);
  const update = fresh(request, cache);
  if (stored === undefined) return update;
  update.catch(() => undefined);
  return stored;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !isSameOrigin(request.url)) return;
  event.respondWith(
    caches
      .open(CACHE)
      .then((cache) =>
        request.mode === 'navigate' ? networkFirst(request, cache) : storedFirst(request, cache),
      ),
  );
});
