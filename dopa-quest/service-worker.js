// DOPA QUEST static-file cache. All personal progress remains in existing browser storage.
const CACHE_NAME = 'dopa-quest-static-20261027-thai-lesson03-v1';
const CACHE_PREFIX = 'dopa-quest-static-';
const APP_SHELL = [
  './','./index.html','./manifest.webmanifest',
  './data/shan-1.json','./data/shan-2.json','./data/burmese.json',
  './firebase-config.js','./sound-fx.js','./study-details.js','./shan-extra-provisional.js',
  './flashcards.js','./vocabulary-library.js','./editorial-notes.js','./editorial-notes-ui.js','./daily-progress.js','./learning-stats.js',
  './dashboard.js','./bootstrap.js','./editorial-hub.js','./game.js','./thai-controls.js','./thai-pilot.html','./data/thai-lesson01-pilot.json','./data/thai-lesson02-reviewed.json','./data/thai-lesson03-reviewed.json',
  './flashcards-ui.js','./vocabulary-ui.js','./cloud-sync.js',
  './icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png',
  './fonts/padauk-myanmar-400.woff2','./fonts/padauk-myanmar-700.woff2'
];

// Optional packs may be unavailable temporarily. Never fail the shell cache as a result.
const OPTIONAL_PACKS = [
  './data/shan-extra-manifest-v1.json',
  './data/shan-extra-pilot-1.json',
  './data/shan-extra-pack-2.json',
  './data/shan-extra-pack-3.json',
  './data/shan-extra-pack-4.json',
  './data/shan-extra-pack-5.json',
  './data/shan-extra-pack-6.json',
  './data/shan-extra-single-proposals-1.json',
  './data/shan-extra-single-proposals-2.json',
  './data/shan-extra-single-proposals-3.json',
  './data/shan-extra-single-proposals-4.json',
  './data/shan-extra-multiple-proposals-1.json',
  './data/shan-extra-final65-proposals-v1.json',
  './data/shan-extra-semicolon-study-release-v1.json',
  './data/shan-extra-general-review-batch1-v1.json',
  './data/shan-extra-general-review-batch2-v1.json',
  './data/shan-extra-general-review-batch3-v1.json',
  './data/shan-extra-general-review-batch4-v1.json',
  './data/shan-extra-held47-review-v1.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(async cache => {
    await cache.addAll(APP_SHELL);
    await Promise.all(OPTIONAL_PACKS.map(path=>cache.add(path).catch(err=>{
      console.warn('Optional offline Shan pack not cached: '+path,err);
    })));
  }));
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
