// DOPA QUEST static-file cache. All personal progress remains in existing browser storage.
const CACHE_NAME = 'dopa-quest-static-20261011-v2';
const CACHE_PREFIX = 'dopa-quest-static-';
const APP_SHELL = [
  './','./index.html','./manifest.webmanifest',
  './data/shan-1.json','./data/shan-2.json','./data/burmese.json',
  './firebase-config.js','./sound-fx.js','./study-details.js',
  './flashcards.js','./vocabulary-library.js','./daily-progress.js',
  './dashboard.js','./bootstrap.js','./game.js',
  './flashcards-ui.js','./vocabulary-ui.js','./cloud-sync.js',
  './icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png',
  './fonts/padauk-myanmar-400.woff2','./fonts/padauk-myanmar-700.woff2'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  // Never intercept Firebase, Google sign-in, third-party resources, or other projects.
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const navigation = request.mode === 'navigate';
  if (!navigation && !/\.(?:html|js|json|png|webmanifest|woff2)$/.test(url.pathname)) return;
  // Network-first: on successful visits this includes vocabulary shards, so a fully
  // loaded deck can be reused without connectivity. No user progress is stored here.
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request,copy))
          .catch(error => console.warn('DOPA QUEST cache storage skipped',error)));
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (navigation) {
        const shell = await caches.match(new URL('./index.html',scope));
        if (shell) return shell;
      }
      throw error;
    }
  })());
});
